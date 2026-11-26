import "server-only";
import { getDiscoForLookup, pickElectricityVerifyProvider } from "@/lib/db/electricity";
import type { MeterLookup } from "@/lib/electricity-purchase";
import { callProviderEndpoint } from "@/lib/providers/call";
import { interpretProviderResponse } from "@/lib/providers/result";
import { findName, mappedAmount, mappedText } from "@/lib/providers/response-map";

export async function lookupMeter(
  discoId: string,
  meterType: string,
  meter: string,
  preferredProviderId?: string | null,
): Promise<MeterLookup> {
  const disco = await getDiscoForLookup(discoId);
  if (!disco) return { status: "unavailable" };
  const providerId = await pickElectricityVerifyProvider(preferredProviderId ?? disco.providerId);
  if (!providerId) return { status: "unavailable" };

  try {
    const result = await callProviderEndpoint(providerId, "electricity_verify", {
      disco: disco.providerCode || discoId,
      meter,
      type: meterType,
    });
    const outcome = interpretProviderResponse(result);
    if (outcome === "failed") {
      return [401, 403, 429].includes(result.status) ? { status: "unavailable" } : { status: "invalid" };
    }
    if (!result.ok) return { status: "unavailable" };

    const name = mappedText(result, "name") ?? (result.map?.name ? null : findName(result.data));
    if (!name) {
      console.warn("[meter-lookup] Provider answered without a customer name", providerId);
      return { status: "unavailable" };
    }
    return {
      status: "found",
      name,
      address: mappedText(result, "address"),
      balance: mappedAmount(result, "balance"),
    };
  } catch (error) {
    console.error("[meter-lookup] Lookup did not complete", providerId, error);
    return { status: "unavailable" };
  }
}
