import "server-only";
import { createHash } from "node:crypto";
import { API_KEY_PATTERN, RATE_LIMIT, RATE_WINDOW_SECONDS, type ApiScope } from "@/lib/api/keys";
import { verifyBearerToken } from "@/lib/api/oidc";
import { apiError } from "@/lib/api/response";
import { findApiKeyByHash, hitRateLimit, touchApiKey } from "@/lib/db/api-keys";
import { syncCustomer } from "@/lib/db/customers";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";

export type ApiContext = {
  kind: "key" | "user";
  customerId: string;
  customerName: string | null;
  packageId: string;
};

export const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

function clientIp(request: Request): string | null {
  return request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    null;
}

export async function authenticateApi(
  request: Request,
  scope: ApiScope,
): Promise<{ ok: true; ctx: ApiContext } | { ok: false; response: Response }> {
  const deny = (response: Response) => ({ ok: false as const, response });
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return deny(apiError("unauthorized", "Send your credentials as: Authorization: Bearer <key or token>.", 401));

  try {
    let ctx: ApiContext;
    let rateKey: string;
    let keyId: string | null = null;

    if (API_KEY_PATTERN.test(token)) {
      const key = await findApiKeyByHash(hashApiKey(token));
      if (!key) return deny(apiError("unauthorized", "That API key isn't valid.", 401));
      if (!key.active) return deny(apiError("account_suspended", "This account is suspended.", 403));
      if (key.ipAllowlist.length > 0) {
        const ip = clientIp(request);
        if (!ip || !key.ipAllowlist.includes(ip)) {
          return deny(apiError("ip_not_allowed", "This key can't be used from your IP address.", 403));
        }
      }
      if (!key.scopes.includes(scope)) {
        return deny(apiError("forbidden", `This key doesn't have the "${scope}" scope.`, 403));
      }
      keyId = key.keyId;
      rateKey = key.keyId;
      ctx = { kind: "key", customerId: key.customerId, customerName: key.customerName, packageId: key.packageId };
    } else {
      const claims = await verifyBearerToken(token);
      if (!claims) return deny(apiError("unauthorized", "That token isn't valid or has expired.", 401));
      let customer = await getCustomerForPurchase(claims.sub);
      if (!customer) {
        await syncCustomer(claims);
        customer = await getCustomerForPurchase(claims.sub);
      }
      if (!customer) return deny(apiError("server_error", "Something went wrong. Try again.", 500));
      if (customer.status !== "active") return deny(apiError("account_suspended", "This account is suspended.", 403));
      rateKey = `user:${claims.sub}`;
      ctx = { kind: "user", customerId: claims.sub, customerName: claims.name ?? null, packageId: customer.packageId };
    }

    const used = await hitRateLimit(rateKey, RATE_WINDOW_SECONDS);
    if (used > RATE_LIMIT) {
      return deny(apiError("rate_limited", `Limit is ${RATE_LIMIT} requests per minute.`, 429, {
        "Retry-After": String(RATE_WINDOW_SECONDS),
      }));
    }
    if (keyId) void touchApiKey(keyId).catch(() => undefined);
    return { ok: true, ctx };
  } catch (error) {
    console.error("[api] Authentication failed", error);
    return deny(apiError("server_error", "Something went wrong. Try again.", 500));
  }
}
