"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { revalidatePath } from "next/cache";
import { hashApiKey } from "@/lib/api/auth";
import { API_PACKAGE_ID, API_PATH, MAX_ACTIVE_KEYS, isApiScope, type ApiScope } from "@/lib/api/keys";
import { recordAudit } from "@/lib/db/audit";
import * as db from "@/lib/db/api-keys";
import { getCustomerPackage } from "@/lib/db/packages";
import { requireSpursUser } from "@/lib/spurs";

export type CreateKeyResult = { ok: true; key: string } | { ok: false; error: string };
export type RevokeKeyResult = { ok: true } | { ok: false; error: string };
const clean = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

export async function createKey(input: unknown): Promise<CreateKeyResult> {
  const user = await requireSpursUser();
  if (!input || typeof input !== "object") return { ok: false, error: "Check the details and try again." };
  const raw = input as Record<string, unknown>;
  const name = clean(raw.name);
  if (!name || name.length > 40) return { ok: false, error: "Enter a name up to 40 characters." };
  const scopes: ApiScope[] = Array.isArray(raw.scopes) ? [...new Set(raw.scopes.filter(isApiScope))] : [];
  if (scopes.length === 0) return { ok: false, error: "Choose at least one permission." };
  const ips = clean(raw.ipAllowlist).split(/[\s,]+/).filter(Boolean);
  if (ips.length > 10 || ips.some((ip) => !isIP(ip))) {
    return { ok: false, error: "Enter up to 10 valid IP addresses, or leave it empty to allow any." };
  }
  try {
    const pkg = await getCustomerPackage(user.sub);
    if (pkg?.id !== API_PACKAGE_ID) {
      return { ok: false, error: "API keys are available on the API package. Upgrade your package first." };
    }
    const key = `vtu_live_${randomBytes(32).toString("base64url")}`;
    const id = randomUUID();
    const created = await db.createApiKey({
      id, customerId: user.sub, name, prefix: key.slice(0, 16),
      keyHash: hashApiKey(key), scopes, ipAllowlist: ips,
    });
    if (!created) return { ok: false, error: `You can have up to ${MAX_ACTIVE_KEYS} active keys. Revoke one first.` };
    await recordAudit(user, {
      action: "api_key.create", target: id, summary: `Created API key ${name}`,
      meta: { scopes, ipCount: ips.length },
    });
    revalidatePath(API_PATH);
    return { ok: true, key };
  } catch (error) {
    console.error("[api-keys] create", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function revokeKey(id: unknown): Promise<RevokeKeyResult> {
  const user = await requireSpursUser();
  if (typeof id !== "string" || !id) return { ok: false, error: "That change isn't valid." };
  try {
    if (!(await db.revokeApiKey(user.sub, id))) return { ok: false, error: "That key is already revoked." };
    await recordAudit(user, { action: "api_key.revoke", target: id, summary: "Revoked an API key" });
    revalidatePath(API_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[api-keys] revoke", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
