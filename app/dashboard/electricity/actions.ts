"use server";

import { revalidatePath } from "next/cache";
import { requireSpursUser } from "@/lib/spurs";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import { getElectricityQuote, pickElectricityProvider } from "@/lib/db/electricity";
import {
  findTransaction,
  finishTransaction,
  markDebited,
  startTransaction,
} from "@/lib/db/transactions";
import { METER_PATTERN, METER_TYPES, electricityPrice } from "@/lib/electricity-purchase";
import type { PurchaseResult } from "@/lib/data-purchase";
import { formatNaira, formatNumber } from "@/lib/format";
import { PHONE_PATTERN } from "@/lib/phone";
import { NotSentError, callProviderEndpoint } from "@/lib/providers/call";
import { interpretProviderResponse, type Outcome } from "@/lib/providers/result";
import { getNairaBalance } from "@/lib/wallet";
import { quoteCharge, takePayment, refundAndMark } from "@/lib/payment";
import { onPurchaseSuccess } from "@/lib/rewards";
import { purchaseMessage, refundNote } from "@/lib/purchase-messages";
import { firstName } from "@/lib/admin/purchase-templates";

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

export async function purchaseElectricity(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  if (!input || typeof input !== "object") return fail(INVALID);

  const { discoId, meterType, meter, amount, phone, reference, useCashback } = input as Record<string, unknown>;
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

  const quote = await getElectricityQuote(discoId, amount, customer.packageId);
  if (!quote) return fail(UNAVAILABLE);

  const price = electricityPrice(amount, quote.discount);
  if (!Number.isFinite(price) || price <= 0) return fail(UNAVAILABLE);
  const cost = quote.providerDiscount === null ? null : round2(amount * (1 - quote.providerDiscount / 100));

  const providerId = await pickElectricityProvider(quote.providerId);
  if (!providerId) return fail("Electricity can't be bought right now. Please try again later.");

  const charge = await quoteCharge(user.sub, price, useCashback === true);
  const balance = await getNairaBalance(user.sub);
  if (balance !== null && balance < charge.walletPart) {
    return fail(`Your wallet balance is ${formatNaira(balance)}. Fund your wallet or use cashback to buy this electricity.`);
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
    cashbackUsed: charge.cashbackUsed,
  });
  if (!started) return fail("That purchase is already being processed. Check your history.");
  const vars = { name: firstName(user.name), item: title, amount: formatNaira(price), recipient: meter };

  let debited = false;
  try {
    debited = await takePayment(user.sub, charge, reference);
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
    await onPurchaseSuccess(reference);
    revalidatePath("/dashboard");
    const tokenNote = token ? ` Token: ${token}` : type.id === "prepaid" ? " Your token will be sent to your phone." : "";
    return { ok: true, status: "success", message: await purchaseMessage("electricity", "success", { ...vars, token_note: tokenNote }) };
  }

  if (outcome === "failed") {
    await finishTransaction(reference, "failed", { reason: REJECTED, response });
    const refunded = await refundAndMark(user.sub, price, charge.cashbackUsed, reference);
    revalidatePath("/dashboard");
    return fail(await purchaseMessage("electricity", "failed", { ...vars, refund_note: refundNote(refunded) }));
  }

  await finishTransaction(reference, "pending", { response });
  revalidatePath("/dashboard");
  return { ok: true, status: "pending", message: await purchaseMessage("electricity", "pending", vars) };
}
