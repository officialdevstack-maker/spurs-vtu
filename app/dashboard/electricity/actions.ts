"use server";

import { revalidatePath } from "next/cache";
import { requireSpursUser } from "@/lib/spurs";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import { getElectricityQuote, pickElectricityProvider } from "@/lib/db/electricity";
import {
  findTransaction,
  finishTransaction,
  markDebited,
  markRefunded,
  startTransaction,
} from "@/lib/db/transactions";
import { METER_PATTERN, METER_TYPES, electricityPrice } from "@/lib/electricity-purchase";
import type { PurchaseResult } from "@/lib/data-purchase";
import { formatNaira, formatNumber } from "@/lib/format";
import { PHONE_PATTERN } from "@/lib/phone";
import { NotSentError, callProviderEndpoint } from "@/lib/providers/call";
import { interpretProviderResponse, type Outcome } from "@/lib/providers/result";
import { creditWallet, debitWallet, getNairaBalance } from "@/lib/wallet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = 1_000_000;
const PENDING_MESSAGE =
  "Your order is being confirmed with the distribution company. Your payment is held, and the status will update in your history.";
const NO_PAYMENT = "We couldn't take payment from your wallet. Check your balance and try again.";
const REJECTED = "The distribution company couldn't process this payment.";
const INVALID = "That purchase isn't valid. Refresh the page and try again.";
const UNAVAILABLE = "That amount isn't available for this disco any more. Refresh the page.";

const fail = (error: string): PurchaseResult => ({ ok: false, error });
const round2 = (value: number) => Math.round(value * 100) / 100;

const TOKEN_KEYS = ["token", "Token", "pin", "purchased_code", "purchasedCode"];

function findToken(data: unknown, depth = 0): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data) || depth > 2) return null;
  const record = data as Record<string, unknown>;
  for (const key of TOKEN_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim() && value.trim().length <= 100) return value.trim();
    if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  }
  return findToken(record.data, depth + 1);
}

async function refund(customerId: string, amount: number, reference: string): Promise<boolean> {
  try {
    if (await creditWallet(customerId, amount, `${reference}:refund`)) {
      await markRefunded(reference);
      return true;
    }
  } catch (error) {
    console.error("[electricity-purchase] Refund call failed", reference, error);
  }
  console.error("[electricity-purchase] Refund needed", reference);
  return false;
}

export async function purchaseElectricity(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  if (!input || typeof input !== "object") return fail(INVALID);

  const { discoId, meterType, meter, amount, phone, reference } = input as Record<string, unknown>;
  const type = METER_TYPES.find((item) => item.id === meterType);
  if (
    typeof discoId !== "string" ||
    !discoId ||
    !type ||
    typeof reference !== "string" ||
    !UUID.test(reference) ||
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    amount > MAX_AMOUNT
  ) {
    return fail(INVALID);
  }
  if (typeof meter !== "string" || !METER_PATTERN.test(meter)) return fail("Enter your meter number, 10 to 13 digits.");
  if (typeof phone !== "string" || !PHONE_PATTERN.test(phone)) return fail("Enter an 11-digit phone number, like 0803 123 4567.");

  const existing = await findTransaction(reference, user.sub);
  if (existing) {
    if (existing.status === "success") return { ok: true, status: "success", message: `${existing.title} was delivered.` };
    if (existing.status === "pending") return { ok: true, status: "pending", message: PENDING_MESSAGE };
    return fail(existing.failureReason ?? "That purchase failed.");
  }

  const customer = await getCustomerForPurchase(user.sub);
  if (!customer) return fail("We couldn't find your account. Refresh the page and try again.");
  if (customer.status === "suspended") return fail("Your account is suspended. Contact support to make purchases.");

  const quote = await getElectricityQuote(discoId, amount);
  if (!quote) return fail(UNAVAILABLE);

  const price = electricityPrice(amount, quote.discount);
  if (!Number.isFinite(price) || price <= 0) return fail(UNAVAILABLE);
  const cost = quote.providerDiscount === null ? null : round2(amount * (1 - quote.providerDiscount / 100));

  const providerId = await pickElectricityProvider(quote.providerId);
  if (!providerId) return fail("Electricity can't be bought right now. Please try again later.");

  const balance = await getNairaBalance(user.sub);
  if (balance !== null && balance < price) {
    return fail(`Your wallet balance is ${formatNaira(balance)}. Fund your wallet to buy this electricity.`);
  }

  const title = `₦${formatNumber(amount)} ${quote.name} ${type.label.toLowerCase()} electricity`;
  const started = await startTransaction({
    id: reference,
    customerId: user.sub,
    service: "electricity",
    title,
    detail: `Meter ${meter}`,
    amount: price,
    cost,
    networkId: null,
    planId: null,
    providerId,
    phone,
  });
  if (!started) return fail("That purchase is already being processed. Check your history.");

  let debited = false;
  try {
    debited = await debitWallet(user.sub, price, reference);
  } catch (error) {
    console.error("[electricity-purchase] Wallet debit status unknown", reference, error);
    try {
      await finishTransaction(reference, "pending", { reason: "Wallet debit status unknown" });
    } catch (updateError) {
      console.error("[electricity-purchase] Could not record unknown wallet debit status", reference, updateError);
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
    console.error("[electricity-purchase] Wallet debited but could not set debited flag", reference, error);
  }

  let outcome: Outcome = "pending";
  let response: string | undefined;
  let token: string | null = null;
  try {
    const result = await callProviderEndpoint(providerId, "electricity", {
      disco: quote.providerCode || discoId,
      meter,
      type: type.id,
      amount,
      phone,
      reference,
    });
    outcome = interpretProviderResponse(result);
    response = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
    token = findToken(result.data);
  } catch (error) {
    response = error instanceof Error ? error.message : "Provider call failed";
    outcome = error instanceof NotSentError ? "failed" : "pending";
    console.error("[electricity-purchase] Provider call did not complete", reference, error);
  }

  if (outcome === "success") {
    await finishTransaction(reference, "success", { response });
    revalidatePath("/dashboard");
    const tail = token ? ` Token: ${token}` : type.id === "prepaid" ? " Your token will be sent to your phone." : "";
    return { ok: true, status: "success", message: `${title} paid for meter ${meter}.${tail}` };
  }

  if (outcome === "failed") {
    await finishTransaction(reference, "failed", { reason: REJECTED, response });
    const refunded = await refund(user.sub, price, reference);
    revalidatePath("/dashboard");
    return fail(refunded
      ? `${REJECTED} Your money has been returned to your wallet.`
      : `${REJECTED} Your refund is being processed and will reach your wallet shortly.`);
  }

  await finishTransaction(reference, "pending", { response });
  revalidatePath("/dashboard");
  return { ok: true, status: "pending", message: PENDING_MESSAGE };
}
