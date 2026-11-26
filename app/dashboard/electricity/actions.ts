"use server";

import { requireSpursUser } from "@/lib/spurs";
import { METER_PATTERN, METER_TYPES, type MeterLookup } from "@/lib/electricity-purchase";
import type { PurchaseResult } from "@/lib/data-purchase";
import { lookupMeter } from "@/lib/meter-lookup";
import { runElectricityPurchase } from "@/lib/purchase/electricity";

export async function checkMeter(input: unknown): Promise<MeterLookup> {
  await requireSpursUser();
  if (!input || typeof input !== "object") return { status: "unavailable" };
  const { discoId, meterType, meter } = input as Record<string, unknown>;
  const type = METER_TYPES.find((item) => item.id === meterType);
  if (
    typeof discoId !== "string" ||
    !/^[a-z0-9-]{1,60}$/.test(discoId) ||
    !type ||
    typeof meter !== "string" ||
    !METER_PATTERN.test(meter)
  ) {
    return { status: "unavailable" };
  }
  return lookupMeter(discoId, type.id, meter);
}

export async function purchaseElectricity(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  return runElectricityPurchase(user, input);
}
