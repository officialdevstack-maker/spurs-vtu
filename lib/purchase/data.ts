import "server-only";
import { getPlanPriceForPackage } from "@/lib/db/airtime-data";
import { getPurchasablePlan, pickDataProvider } from "@/lib/db/data-purchase";
import type { PurchaseResult } from "@/lib/data-purchase";
import { networkMismatchMessage } from "@/lib/network-prefix";
import { PHONE_PATTERN, groupPhone } from "@/lib/phone";
import { planAlternates } from "@/lib/db/failover";
import {
  BAD_PHONE,
  executePurchase,
  INVALID_PURCHASE,
  openPurchase,
  purchaseFail,
  REFERENCE,
} from "@/lib/purchase/execute";

const UNAVAILABLE = "That plan isn't available any more. Refresh the page.";
export type PurchaseUser = { sub: string; name?: string | null };

export async function runDataPurchase(
  user: PurchaseUser,
  input: unknown,
  options: { skipPin?: boolean } = {},
): Promise<PurchaseResult> {
  if (!input || typeof input !== "object") return purchaseFail(INVALID_PURCHASE);
  const { planId, phone, reference, skipNetworkCheck, useCashback, promoCode, pin } = input as Record<string, unknown>;
  if (typeof planId !== "string" || !planId || typeof reference !== "string" || !REFERENCE.test(reference)) {
    return purchaseFail(INVALID_PURCHASE);
  }
  if (typeof phone !== "string" || !PHONE_PATTERN.test(phone)) return purchaseFail(BAD_PHONE);

  const opened = await openPurchase("data", user.sub, reference, pin, options);
  if ("result" in opened) return opened.result;

  const plan = await getPurchasablePlan(planId);
  if (!plan) return purchaseFail(UNAVAILABLE);
  const mismatch = skipNetworkCheck === true ? null : networkMismatchMessage(phone, plan.networkId, plan.networkName);
  if (mismatch) return purchaseFail(mismatch);
  const price = await getPlanPriceForPackage(plan.id, opened.customer.packageId);
  if (price === null || !Number.isFinite(price) || price <= 0) return purchaseFail(UNAVAILABLE);
  const providerId = await pickDataProvider(plan.providerId);
  if (!providerId) return purchaseFail("This plan can't be bought right now. Please try again later.");

  const recipient = groupPhone(phone);
  const providerVars = { phone, amount: plan.cost, network: plan.networkId, plan: plan.providerPlanId, reference };
  const alternates = await planAlternates("data", plan.id, providerId, providerVars);
  return executePurchase({
    service: "data",
    reference,
    user,
    useCashback: useCashback === true,
    price,
    cost: plan.cost,
    title: `${plan.size} ${plan.networkName} ${plan.typeLabel}`,
    detail: recipient,
    networkId: plan.networkId,
    planId: plan.id,
    providerId,
    phone,
    recipient,
    providerService: "data",
    providerVars,
    alternates,
    promoCode: typeof promoCode === "string" && promoCode.trim() ? promoCode : null,
  });
}
