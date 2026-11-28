import "server-only";
import { getCachedToken, getProviderForCall, saveToken } from "@/lib/db/providers";
import { fill } from "@/lib/providers/fill";
import { readPath, toAmount, toText } from "@/lib/providers/response-map";

const DEFAULT_TTL = 50 * 60;
const MIN_TTL = 30;
const MAX_TTL = 24 * 60 * 60;
const SKEW = 60;

export async function getLoginToken(
  providerId: string,
  fresh = false,
  includeDisabled = false,
): Promise<string> {
  if (!fresh) {
    try {
      const cached = await getCachedToken(providerId);
      if (cached) return cached;
    } catch (error) {
      console.error("[provider-login] Could not read cached token", providerId, error instanceof Error ? error.name : "Unknown error");
    }
  }

  const login = await getProviderForCall(providerId, "auth", includeDisabled);
  if (!login) throw new Error("This provider logs in for a token but has no active Login endpoint.");
  const tokenPath = login.responseMap.token;
  if (!tokenPath) throw new Error("The Login endpoint needs a token path in its response mapping.");
  if (!login.authUsername || !login.secret) throw new Error("Add the login username and password to this provider.");

  const vars = { username: login.authUsername, password: login.secret };
  const url = new URL(`${login.baseUrl}${fill(login.path, vars, "path")}`);
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: string | undefined;
  if (login.method === "POST" && login.bodyTemplate) {
    headers["Content-Type"] = "application/json";
    body = fill(login.bodyTemplate, vars, "body");
  } else {
    headers.Authorization = `Basic ${Buffer.from(`${login.authUsername}:${login.secret}`).toString("base64")}`;
  }

  const response = await fetch(url, {
    method: login.method,
    headers,
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(login.timeoutMs),
  });
  if (!response.ok) throw new Error(`Provider login failed with status ${response.status}.`);

  let data: unknown = null;
  try {
    data = JSON.parse(await response.text());
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  const token = toText(readPath(data, tokenPath), 4000);
  if (!token) throw new Error("The login response had no token at the mapped path.");

  const seconds = login.responseMap.expires_in ? toAmount(readPath(data, login.responseMap.expires_in)) : null;
  const ttl = Math.min(MAX_TTL, Math.max(MIN_TTL, (seconds ?? DEFAULT_TTL) - SKEW));
  try {
    await saveToken(providerId, token, new Date(Date.now() + ttl * 1000));
  } catch (error) {
    console.error("[provider-login] Could not cache token", providerId, error instanceof Error ? error.name : "Unknown error");
  }
  return token;
}
