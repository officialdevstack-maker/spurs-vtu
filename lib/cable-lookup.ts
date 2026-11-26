import "server-only";
import { pickCableVerifyProvider } from "@/lib/db/cable";
import { callProviderEndpoint } from "@/lib/providers/call";
import { interpretProviderResponse } from "@/lib/providers/result";
import { findName, mappedText } from "@/lib/providers/response-map";

export type SmartcardLookup =
  | { status: "found"; name: string }
  | { status: "invalid" }
  | { status: "unavailable" };

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
      const name = mappedText(result, "name") ?? (result.map?.name ? null : findName(result.data));
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
