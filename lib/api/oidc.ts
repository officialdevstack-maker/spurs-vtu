import "server-only";
import { createHash, createPublicKey, verify, type JsonWebKey } from "node:crypto";

export type OidcClaims = { sub: string; name?: string; username?: string; email?: string; phone?: string };

type Jwk = JsonWebKey & { kid?: string; use?: string };
type Discovery = { issuer?: string; jwks_uri?: string; userinfo_endpoint?: string };

const TIMEOUT_MS = 5_000;
const DISCOVERY_TTL_MS = 10 * 60_000;
const JWKS_MIN_REFETCH_MS = 60_000;
const USERINFO_TTL_MS = 60_000;
const SKEW_SECONDS = 30;

function issuer(): string {
  const value = process.env.SPURS_ISSUER?.trim().replace(/\/+$/, "");
  if (!value) throw new Error("SPURS_ISSUER is not set.");
  return value;
}

function audiences(): string[] {
  return [process.env.SPURS_CLIENT_ID, ...(process.env.SPURS_MOBILE_CLIENT_IDS ?? "").split(",")]
    .map((value) => value?.trim())
    .filter((value): value is string => !!value);
}

async function getJson<T>(url: string, headers: HeadersInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${new URL(url).pathname} returned ${response.status}`);
  return (await response.json()) as T;
}

let discovery: { value: Discovery; at: number } | null = null;
async function getDiscovery(): Promise<Discovery> {
  if (discovery && Date.now() - discovery.at < DISCOVERY_TTL_MS) return discovery.value;
  const value = await getJson<Discovery>(`${issuer()}/.well-known/openid-configuration`);
  discovery = { value, at: Date.now() };
  return value;
}

let jwks: { keys: Jwk[]; at: number } | null = null;
async function findKey(kid: string | undefined): Promise<Jwk | null> {
  const pick = (keys: Jwk[]) =>
    keys.find((key) => key.kty === "RSA" && (!kid || key.kid === kid) && (!key.use || key.use === "sig")) ?? null;
  if (jwks) {
    const hit = pick(jwks.keys);
    if (hit) return hit;
    if (Date.now() - jwks.at < JWKS_MIN_REFETCH_MS) return null;
  }
  const { jwks_uri } = await getDiscovery();
  if (!jwks_uri) throw new Error("The issuer's discovery document has no jwks_uri.");
  const body = await getJson<{ keys?: Jwk[] }>(jwks_uri);
  jwks = { keys: Array.isArray(body.keys) ? body.keys : [], at: Date.now() };
  return pick(jwks.keys);
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : undefined);
function claimsFrom(record: Record<string, unknown>): OidcClaims | null {
  const sub = text(record.sub);
  if (!sub) return null;
  return {
    sub,
    name: text(record.name),
    username: text(record.preferred_username) ?? text(record.username),
    email: text(record.email),
    phone: text(record.phone_number) ?? text(record.phone),
  };
}

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;

async function verifyJwt(token: string): Promise<OidcClaims | null> {
  const [head, body, signature] = token.split(".");
  if (!head || !body || !signature) return null;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decode(head);
    payload = decode(body);
  } catch {
    return null;
  }
  if (header.alg !== "RS256") return null;
  const jwk = await findKey(typeof header.kid === "string" ? header.kid : undefined);
  if (!jwk) return null;
  const valid = verify(
    "RSA-SHA256",
    Buffer.from(`${head}.${body}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(signature, "base64url"),
  );
  if (!valid) return null;
  const now = Math.floor(Date.now() / 1000);
  const tokenIssuer = typeof payload.iss === "string" ? payload.iss.replace(/\/+$/, "") : "";
  const tokenAudiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (tokenIssuer !== issuer()) return null;
  if (!tokenAudiences.some((aud) => typeof aud === "string" && audiences().includes(aud))) return null;
  if (typeof payload.exp !== "number" || payload.exp + SKEW_SECONDS < now) return null;
  if (typeof payload.nbf === "number" && payload.nbf - SKEW_SECONDS > now) return null;
  return claimsFrom(payload);
}

const userinfoCache = new Map<string, { claims: OidcClaims; expires: number }>();
async function verifyOpaque(token: string): Promise<OidcClaims | null> {
  const cacheKey = createHash("sha256").update(token).digest("hex");
  const cached = userinfoCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.claims;
  const { userinfo_endpoint } = await getDiscovery();
  if (!userinfo_endpoint) return null;
  let data: Record<string, unknown>;
  try {
    data = await getJson<Record<string, unknown>>(userinfo_endpoint, { Authorization: `Bearer ${token}` });
  } catch {
    return null;
  }
  const claims = claimsFrom(data);
  if (!claims) return null;
  if (userinfoCache.size >= 500) userinfoCache.clear();
  userinfoCache.set(cacheKey, { claims, expires: Date.now() + USERINFO_TTL_MS });
  return claims;
}

export async function verifyBearerToken(token: string): Promise<OidcClaims | null> {
  if (!token || token.length > 4000) return null;
  try {
    return token.split(".").length === 3 ? await verifyJwt(token) : await verifyOpaque(token);
  } catch (error) {
    console.error("[api] Token check failed", error instanceof Error ? error.message : error);
    return null;
  }
}
