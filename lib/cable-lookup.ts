import "server-only";
import { pickCableVerifyProvider } from "@/lib/db/cable";
import { callProviderEndpoint } from "@/lib/providers/call";
import { interpretProviderResponse } from "@/lib/providers/result";

export type SmartcardLookup =
  | { status: "found"; name: string }
  | { status: "invalid" }
  | { status: "unavailable" };

const NAME_KEYS = [
  "customer_name",
  "customerName",
  "Customer_Name",
  "account_name",
  "accountName",
  "full_name",
  "fullName",
  "name",
];

function findName(data: unknown, depth = 0): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data) || depth > 2) return null;
  const record = data as Record<string, unknown>;
  for (const key of NAME_KEYS) {
    const value = record[key];
    if (typeof value === "string") {
      const name = value.replace(/\s+/g, " ").trim();
      if (name) return name.slice(0, 80);
    }
  }
  return findName(record.data, depth + 1) ?? findName(record.content, depth + 1);
}

export async function lookupSmartcard(
  operatorId: string,
  smartcard: string,
  preferredProviderId: string | null = null,
): Promise<SmartcardLookup> {
  const providerId = await pickCableVerifyProvider(preferredProviderId);
  if (!providerId) return { status: "unavailable" };

  try {
    const result = await callProviderEndpoint(providerId, "cable_verify", { smartcard, operator: operatorId });
    const outcome = interpretProviderResponse(result);
    if (result.ok && outcome !== "failed") {
      const name = findName(result.data);
      if (name) return { status: "found", name };
      console.warn("[cable-lookup] Provider answered without a customer name", providerId);
      return { status: "unavailable" };
    }
    if (outcome === "failed" && ![401, 403, 429].includes(result.status)) return { status: "invalid" };
    return { status: "unavailable" };
  } catch (error) {
    console.error("[cable-lookup] Lookup did not complete", providerId, error);
    return { status: "unavailable" };
  }
}
