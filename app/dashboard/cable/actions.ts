"use server";

import { revalidatePath } from "next/cache";
import { requireSpursUser } from "@/lib/spurs";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import { getCablePlanPriceForPackage, getPurchasableCablePlan, pickCableProvider } from "@/lib/db/cable";
import { findTransaction, finishTransaction, markDebited, startTransaction } from "@/lib/db/transactions";
import { SMARTCARD_PATTERN } from "@/lib/cable-purchase";
import { lookupSmartcard, type SmartcardLookup } from "@/lib/cable-lookup";
import type { PurchaseResult } from "@/lib/data-purchase";
import { formatNaira } from "@/lib/format";
import { PHONE_PATTERN } from "@/lib/phone";
import { NotSentError, callProviderEndpoint } from "@/lib/providers/call";
import { interpretProviderResponse, type Outcome } from "@/lib/providers/result";
import { getNairaBalance } from "@/lib/wallet";
import { quoteCharge, takePayment, refundAndMark } from "@/lib/payment";
import { onPurchaseSuccess } from "@/lib/rewards";
import { purchaseMessage, refundNote } from "@/lib/purchase-messages";
import { firstName } from "@/lib/admin/purchase-templates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PENDING_MESSAGE =
  "Your renewal is being confirmed with the provider. Your payment is held, and the status will update in your history.";
const NO_PAYMENT = "We couldn't take payment from your wallet. Check your balance and try again.";
const REJECTED = "The provider couldn't renew this subscription.";
const INVALID = "That purchase isn't valid. Refresh the page and try again.";
const UNAVAILABLE = "That bouquet isn't available any more. Refresh the page.";

const fail = (error: string): PurchaseResult => ({ ok: false, error });

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
  if (!input || typeof input !== "object") return fail(INVALID);

  const { planId, smartcard, phone, reference, useCashback } = input as Record<string, unknown>;
  if (typeof planId !== "string" || !planId || typeof reference !== "string" || !UUID.test(reference)) {
    return fail(INVALID);
  }
  if (typeof smartcard !== "string" || !SMARTCARD_PATTERN.test(smartcard)) {
    return fail("Enter your decoder or smartcard number, 10 or 11 digits.");
  }
  if (typeof phone !== "string" || !PHONE_PATTERN.test(phone)) {
    return fail("Enter an 11-digit phone number, like 0803 123 4567.");
  }

  const existing = await findTransaction(reference, user.sub);
  if (existing) {
    if (existing.status === "success") return { ok: true, status: "success", message: `${existing.title} was renewed.` };
    if (existing.status === "pending") return { ok: true, status: "pending", message: PENDING_MESSAGE };
    return fail(existing.failureReason ?? "That purchase failed.");
  }

  const customer = await getCustomerForPurchase(user.sub);
  if (!customer) return fail("We couldn't find your account. Refresh the page and try again.");
  if (customer.status === "suspended") return fail("Your account is suspended. Contact support to make purchases.");

  const plan = await getPurchasableCablePlan(planId);
  if (!plan) return fail(UNAVAILABLE);

  const price = await getCablePlanPriceForPackage(plan.id, customer.packageId);
  if (price === null || !Number.isFinite(price) || price <= 0) return fail(UNAVAILABLE);

  const providerId = await pickCableProvider(plan.providerId);
  if (!providerId) return fail("Cable TV can't be renewed right now. Please try again later.");

  const check: SmartcardLookup = await lookupSmartcard(plan.operatorId, smartcard, plan.providerId);
  if (check.status === "invalid") return fail("We couldn't find that decoder number. Check it and try again.");
  const holder = check.status === "found" ? check.name : null;

  const charge = await quoteCharge(user.sub, price, useCashback === true);
  const balance = await getNairaBalance(user.sub);
  if (balance !== null && balance < charge.walletPart) {
    return fail(`Your wallet balance is ${formatNaira(balance)}. Fund your wallet or use cashback to renew this bouquet.`);
  }

  const title = plan.name.toLowerCase().startsWith(plan.operatorName.toLowerCase())
    ? plan.name
    : `${plan.operatorName} ${plan.name}`;
  const started = await startTransaction({
    id: reference,
    customerId: user.sub,
    service: "cable",
    title,
    detail: holder ? `Decoder ${smartcard} · ${holder}` : `Decoder ${smartcard}`,
    amount: price,
    cost: plan.cost,
    networkId: null,
    planId: plan.id,
    providerId,
    phone,
    cashbackUsed: charge.cashbackUsed,
  });
  if (!started) return fail("That purchase is already being processed. Check your history.");
  const vars = { name: firstName(user.name), item: title, amount: formatNaira(price), recipient: smartcard };

  let debited = false;
  try {
    debited = await takePayment(user.sub, charge, reference);
  } catch (error) {
    console.error("[cable-purchase] Wallet debit status unknown", reference, error);
    try {
      await finishTransaction(reference, "pending", { reason: "Wallet debit status unknown" });
    } catch (updateError) {
      console.error("[cable-purchase] Could not record unknown wallet debit status", reference, updateError);
    }
    return fail("Something went wrong with your wallet. Check your balance and history before trying again.");
  }

  if (!debited) {
    await finishTransaction(reference, "failed", { reason: NO_PAYMENT });
    return fail(NO_PAYMENT);
  }

  try {
    await markDebited(reference);
  } catch (error) {
    console.error("[cable-purchase] Wallet debited but could not set debited flag", reference, error);
  }

  let outcome: Outcome = "pending";
  let response: string | undefined;
  try {
    const result = await callProviderEndpoint(providerId, "cable", {
      smartcard,
      operator: plan.operatorId,
      plan: plan.providerPlanId,
      amount: plan.cost,
      phone,
      reference,
    });
    outcome = interpretProviderResponse(result);
    response = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
  } catch (error) {
    response = error instanceof Error ? error.message : "Provider call failed";
    outcome = error instanceof NotSentError ? "failed" : "pending";
    console.error("[cable-purchase] Provider call did not complete", reference, error);
  }

  if (outcome === "success") {
    await finishTransaction(reference, "success", { response });
    await onPurchaseSuccess(reference);
    revalidatePath("/dashboard");
    return { ok: true, status: "success", message: await purchaseMessage("cable", "success", vars) };
  }

  if (outcome === "failed") {
    await finishTransaction(reference, "failed", { reason: REJECTED, response });
    const refunded = await refundAndMark(user.sub, price, charge.cashbackUsed, reference);
    revalidatePath("/dashboard");
    return fail(await purchaseMessage("cable", "failed", { ...vars, refund_note: refundNote(refunded) }));
  }

  await finishTransaction(reference, "pending", { response });
  revalidatePath("/dashboard");
  return { ok: true, status: "pending", message: await purchaseMessage("cable", "pending", vars) };
}
