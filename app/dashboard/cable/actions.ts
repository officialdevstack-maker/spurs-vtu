"use server";

import { requireSpursUser } from "@/lib/spurs";
import { SMARTCARD_PATTERN } from "@/lib/cable-purchase";
import { lookupSmartcard } from "@/lib/cable-lookup";
import type { PurchaseResult } from "@/lib/data-purchase";
import { runCablePurchase } from "@/lib/purchase/cable";

export type SmartcardCheckResult =
  | { status: "found"; name: string }
  | { status: "invalid" }
  | { status: "unavailable" };

export async function checkSmartcard(input: unknown): Promise<SmartcardCheckResult> {
  await requireSpursUser();
  if (!input || typeof input !== "object") return { status: "unavailable" };
  const { operatorId, smartcard } = input as Record<string, unknown>;
  if (
    typeof operatorId !== "string" ||
    !/^[a-z0-9-]{1,40}$/.test(operatorId) ||
    typeof smartcard !== "string" ||
    !SMARTCARD_PATTERN.test(smartcard)
  ) {
    return { status: "unavailable" };
  }
  return lookupSmartcard(operatorId, smartcard);
}

export async function purchaseCable(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  return runCablePurchase(user, input);
}
