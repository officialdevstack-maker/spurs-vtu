"use server";

import { requireSpursUser } from "@/lib/spurs";
import type { PurchaseResult } from "@/lib/data-purchase";
import { runAirtimePurchase } from "@/lib/purchase/airtime";

export async function purchaseAirtime(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  return runAirtimePurchase(user, input);
}
