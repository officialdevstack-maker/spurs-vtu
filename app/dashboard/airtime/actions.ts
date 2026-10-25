"use server";

import { revalidatePath } from "next/cache";
import { requireSpursUser } from "@spurs-cloud/accounts/next";
import { airtimePrice } from "@/lib/airtime-purchase";
import { getAirtimeQuote, pickAirtimeProvider } from "@/lib/db/airtime-purchase";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import {
  findTransaction,
  finishTransaction,
  markDebited,
  markRefunded,
  startTransaction,
} from "@/lib/db/transactions";
import type { PurchaseResult } from "@/lib/data-purchase";
import { formatNaira, formatNumber } from "@/lib/format";
import { PHONE_PATTERN, groupPhone } from "@/lib/phone";
import { NotSentError, callProviderEndpoint } from "@/lib/providers/call";
import { interpretProviderResponse, type Outcome } from "@/lib/providers/result";
import { creditWallet, debitWallet, getNairaBalance } from "@/lib/wallet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = 1_000_000;

const PENDING_MESSAGE =
  "Your order is being confirmed with the network. Your payment is held, and the status will update in your history.";
const NO_PAYMENT = "We couldn't take payment from your wallet. Check your balance and try again.";
const REJECTED = "The network couldn't deliver this airtime.";
const INVALID = "That purchase isn't valid. Refresh the page and try again.";
const UNAVAILABLE = "That amount isn't available for this network any more. Refresh the page.";

const fail = (error: string): PurchaseResult => ({ ok: false, error });
const round2 = (value: number) => Math.round(value * 100) / 100;

async function refund(customerId: string, amount: number, reference: string): Promise<boolean> {
  try {
    if (await creditWallet(customerId, amount, `${reference}:refund`)) {
      await markRefunded(reference);
      return true;
    }
  } catch (error) {
    console.error("[airtime-purchase] Refund call failed", reference, error);
  }
  console.error("[airtime-purchase] Refund needed", reference);
  return false;
}

export async function purchaseAirtime(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  if (!input || typeof input !== "object") return fail(INVALID);

  const { networkId, typeId, amount, phone, reference } = input as Record<string, unknown>;
  if (
    typeof networkId !== "string" ||
    !networkId ||
    typeof typeId !== "string" ||
    !typeId ||
    typeof reference !== "string" ||
    !UUID.test(reference) ||
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    amount > MAX_AMOUNT
  ) {
    return fail(INVALID);
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

  const quote = await getAirtimeQuote(networkId, typeId, amount);
  if (!quote) return fail(UNAVAILABLE);

  const price = airtimePrice(amount, quote.discount);
  if (!Number.isFinite(price) || price <= 0) return fail(UNAVAILABLE);
  const cost = quote.providerDiscount === null ? null : round2(amount * (1 - quote.providerDiscount / 100));

  const providerId = await pickAirtimeProvider(quote.providerId);
  if (!providerId) return fail("Airtime can't be bought right now. Please try again later.");

  const balance = await getNairaBalance(user.sub);
  if (balance !== null && balance < price) {
    return fail(`Your wallet balance is ${formatNaira(balance)}. Fund your wallet to buy this airtime.`);
  }

  const title = `₦${formatNumber(amount)} ${quote.networkName} ${quote.typeLabel} airtime`;
  const started = await startTransaction({
    id: reference,
    customerId: user.sub,
    service: "airtime",
    title,
    detail: groupPhone(phone),
    amount: price,
    cost,
    networkId,
    planId: null,
    providerId,
    phone,
  });
  if (!started) return fail("That purchase is already being processed. Check your history.");

  let debited = false;
  try {
    debited = await debitWallet(user.sub, price, reference);
  } catch (error) {
    console.error("[airtime-purchase] Wallet debit status unknown", reference, error);
    try {
      await finishTransaction(reference, "pending", { reason: "Wallet debit status unknown" });
    } catch (updateError) {
      console.error("[airtime-purchase] Could not record unknown wallet debit status", reference, updateError);
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
    console.error("[airtime-purchase] Wallet debited but could not set debited flag", reference, error);
  }

  let outcome: Outcome = "pending";
  let response: string | undefined;
  try {
    const result = await callProviderEndpoint(providerId, "airtime", {
      phone,
      amount,
      network: networkId,
      type: quote.typeLabel,
      reference,
    });
    outcome = interpretProviderResponse(result);
    response = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
  } catch (error) {
    response = error instanceof Error ? error.message : "Provider call failed";
    outcome = error instanceof NotSentError ? "failed" : "pending";
    console.error("[airtime-purchase] Provider call did not complete", reference, error);
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
