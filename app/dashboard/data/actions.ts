"use server";

import { requireSpursUser } from "@/lib/spurs";
import type { PurchaseResult } from "@/lib/data-purchase";
import { runDataPurchase } from "@/lib/purchase/data";

export async function purchaseData(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  return runDataPurchase(user, input);
}
