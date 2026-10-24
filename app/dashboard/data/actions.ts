"use server";

import { revalidatePath } from "next/cache";
import { requireSpursUser } from "@spurs-cloud/accounts/next";
import { getPlanPriceForPackage } from "@/lib/db/airtime-data";
import { getCustomerForPurchase, getPurchasablePlan, pickDataProvider } from "@/lib/db/data-purchase";
import {
  findTransaction,
  finishTransaction,
  markDebited,
  markRefunded,
  startTransaction,
} from "@/lib/db/transactions";
import type { PurchaseResult } from "@/lib/data-purchase";
import { formatNaira } from "@/lib/format";
import { PHONE_PATTERN, groupPhone } from "@/lib/phone";
import { NotSentError, callProviderEndpoint } from "@/lib/providers/call";
import { interpretProviderResponse, type Outcome } from "@/lib/providers/result";
import { creditWallet, debitWallet, getNairaBalance } from "@/lib/wallet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PENDING_MESSAGE =
  "Your order is being confirmed with the network. Your payment is held, and the status will update in your history.";
const NO_PAYMENT = "We couldn't take payment from your wallet. Check your balance and try again.";
const REJECTED = "The network couldn't deliver this plan.";

const fail = (error: string): PurchaseResult => ({ ok: false, error });

async function refund(customerId: string, amount: number, reference: string): Promise<boolean> {
  try {
    if (await creditWallet(customerId, amount, `${reference}:refund`)) {
      await markRefunded(reference);
      return true;
    }
  } catch (error) {
    console.error("[data-purchase] Refund call failed", reference, error);
  }
  console.error("[data-purchase] Refund needed", reference);
  return false;
}

export async function purchaseData(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  if (!input || typeof input !== "object") {
    return fail("That purchase isn't valid. Refresh the page and try again.");
  }

  const { planId, phone, reference } = input as Record<string, unknown>;
  if (typeof planId !== "string" || !planId || typeof reference !== "string" || !UUID.test(reference)) {
    return fail("That purchase isn't valid. Refresh the page and try again.");
  }
  if (typeof phone !== "string" || !PHONE_PATTERN.test(phone)) {
    return fail("Enter an 11-digit phone number, like 0803 123 4567.");
  }

  const existing = await findTransaction(reference, user.sub);
  if (existing) {
    if (existing.status === "success") {
      return { ok: true, status: "success", message: `${existing.title} was delivered.` };
    }
    if (existing.status === "pending") return { ok: true, status: "pending", message: PENDING_MESSAGE };
    return fail(existing.failureReason ?? "That purchase failed.");
  }

  const customer = await getCustomerForPurchase(user.sub);
  if (!customer) return fail("We couldn't find your account. Refresh the page and try again.");
  if (customer.status === "suspended") return fail("Your account is suspended. Contact support to make purchases.");

  const plan = await getPurchasablePlan(planId);
  if (!plan) return fail("That plan isn't available any more. Refresh the page.");

  const price = await getPlanPriceForPackage(plan.id, customer.packageId);
  if (price === null || !Number.isFinite(price) || price <= 0) {
    return fail("That plan isn't available any more. Refresh the page.");
  }

  const providerId = await pickDataProvider(plan.providerId);
  if (!providerId) return fail("This plan can't be bought right now. Please try again later.");

  const balance = await getNairaBalance(user.sub);
  if (balance !== null && balance < price) {
    return fail(`Your wallet balance is ${formatNaira(balance)}. Fund your wallet to buy this plan.`);
  }

  const title = `${plan.size} ${plan.networkName} ${plan.typeLabel}`;
  const started = await startTransaction({
    id: reference,
    customerId: user.sub,
    service: "data",
    title,
    detail: groupPhone(phone),
    amount: price,
    cost: plan.cost,
    networkId: plan.networkId,
    planId: plan.id,
    providerId,
    phone,
  });
  if (!started) return fail("That purchase is already being processed. Check your history.");

  let debited = false;
  try {
    debited = await debitWallet(user.sub, price, reference);
  } catch (error) {
    console.error("[data-purchase] Wallet debit status unknown", reference, error);
    try {
      await finishTransaction(reference, "pending", { reason: "Wallet debit status unknown" });
    } catch (updateError) {
      console.error("[data-purchase] Could not record unknown wallet debit status", reference, updateError);
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
    console.error("[data-purchase] Wallet debited but could not set debited flag", reference, error);
  }

  let outcome: Outcome = "pending";
  let response: string | undefined;
  try {
    const result = await callProviderEndpoint(providerId, "data", {
      phone,
      amount: plan.cost,
      network: plan.networkId,
      plan: plan.providerPlanId,
      reference,
    });
    outcome = interpretProviderResponse(result);
    response = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
  } catch (error) {
    response = error instanceof Error ? error.message : "Provider call failed";
    outcome = error instanceof NotSentError ? "failed" : "pending";
    console.error("[data-purchase] Provider call did not complete", reference, error);
  }

  if (outcome === "success") {
    await finishTransaction(reference, "success", { response });
    revalidatePath("/dashboard");
    return { ok: true, status: "success", message: `${title} sent to ${groupPhone(phone)}.` };
  }

  if (outcome === "failed") {
    await finishTransaction(reference, "failed", { reason: REJECTED, response });
    const refunded = await refund(user.sub, price, reference);
    revalidatePath("/dashboard");
    return fail(
      refunded
        ? `${REJECTED} Your money has been returned to your wallet.`
        : `${REJECTED} Your refund is being processed and will reach your wallet shortly.`,
    );
  }

  await finishTransaction(reference, "pending", { response });
  revalidatePath("/dashboard");
  return { ok: true, status: "pending", message: PENDING_MESSAGE };
}
