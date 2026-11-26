"use server";

import { requireSpursUser } from "@/lib/spurs";
import { getCablePlanPriceForPackage, getPurchasableCablePlan, pickCableProvider } from "@/lib/db/cable";
import { SMARTCARD_PATTERN } from "@/lib/cable-purchase";
import { lookupSmartcard } from "@/lib/cable-lookup";
import type { PurchaseResult } from "@/lib/data-purchase";
import { PHONE_PATTERN } from "@/lib/phone";
import { planAlternates } from "@/lib/db/failover";
import {
  BAD_PHONE,
  executePurchase,
  INVALID_PURCHASE,
  openPurchase,
  purchaseFail,
  REFERENCE,
} from "@/lib/purchase/execute";

const UNAVAILABLE = "That bouquet isn't available any more. Refresh the page.";

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
  if (!input || typeof input !== "object") return purchaseFail(INVALID_PURCHASE);

  const { planId, smartcard, phone, reference, useCashback, pin } = input as Record<string, unknown>;
  if (typeof planId !== "string" || !planId || typeof reference !== "string" || !REFERENCE.test(reference)) {
    return purchaseFail(INVALID_PURCHASE);
  }
  if (typeof smartcard !== "string" || !SMARTCARD_PATTERN.test(smartcard)) {
    return purchaseFail("Enter your decoder or smartcard number, 10 or 11 digits.");
  }
  if (typeof phone !== "string" || !PHONE_PATTERN.test(phone)) return purchaseFail(BAD_PHONE);

  const opened = await openPurchase("cable", user.sub, reference, pin);
  if ("result" in opened) return opened.result;

  const plan = await getPurchasableCablePlan(planId);
  if (!plan) return purchaseFail(UNAVAILABLE);

  const price = await getCablePlanPriceForPackage(plan.id, opened.customer.packageId);
  if (price === null || !Number.isFinite(price) || price <= 0) return purchaseFail(UNAVAILABLE);

  const providerId = await pickCableProvider(plan.providerId);
  if (!providerId) return purchaseFail("Cable TV can't be renewed right now. Please try again later.");

  const check = await lookupSmartcard(plan.operatorId, smartcard, plan.providerId);
  if (check.status === "invalid") return purchaseFail("We couldn't find that decoder number. Check it and try again.");
  const holder = check.status === "found" ? check.name : null;

  const title = plan.name.toLowerCase().startsWith(plan.operatorName.toLowerCase())
    ? plan.name
    : `${plan.operatorName} ${plan.name}`;

  const providerVars = {
    smartcard,
    operator: plan.operatorId,
    plan: plan.providerPlanId,
    amount: plan.cost,
    phone,
    reference,
  };
  const alternates = await planAlternates("cable", plan.id, providerId, providerVars);
  return executePurchase({
    service: "cable",
    reference,
    user,
    useCashback: useCashback === true,
    price,
    cost: plan.cost,
    title,
    detail: holder ? `Decoder ${smartcard} · ${holder}` : `Decoder ${smartcard}`,
    networkId: null,
    planId: plan.id,
    providerId,
    phone,
    recipient: smartcard,
    providerService: "cable",
    providerVars,
    alternates,
  });
}
