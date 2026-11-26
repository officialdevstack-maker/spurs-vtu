"use server";

import { revalidatePath } from "next/cache";
import { requireSpursUser } from "@/lib/spurs";
import { airtimePrice } from "@/lib/airtime-purchase";
import { getAirtimeQuote, pickAirtimeProvider } from "@/lib/db/airtime-purchase";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import {
  findTransaction,
  finishTransaction,
  markDebited,
  startTransaction,
} from "@/lib/db/transactions";
import type { PurchaseResult } from "@/lib/data-purchase";
import { formatNaira, formatNumber } from "@/lib/format";
import { networkMismatchMessage } from "@/lib/network-prefix";
import { PHONE_PATTERN, groupPhone } from "@/lib/phone";
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
  "Your order is being confirmed with the network. Your payment is held, and the status will update in your history.";
const NO_PAYMENT = "We couldn't take payment from your wallet. Check your balance and try again.";
const REJECTED = "The network couldn't deliver this airtime.";
const INVALID = "That purchase isn't valid. Refresh the page and try again.";
const UNAVAILABLE = "That amount isn't available for this network any more. Refresh the page.";

const fail = (error: string): PurchaseResult => ({ ok: false, error });
const round2 = (value: number) => Math.round(value * 100) / 100;

const PROVIDER_DIAGNOSTIC_KEYS = new Set([
  "status",
  "state",
  "success",
  "code",
  "message",
  "error",
  "errors",
  "reason",
  "description",
  "data",
  "response",
  "content",
  "result",
  "transaction",
  "transactions",
  "details",
]);

function redactProviderText(value: string, phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return value
    .split(phone)
    .join("[redacted phone]")
    .split(digits)
    .join("[redacted phone]")
    .replace(/\b0[789][01]\d{8}\b|\+?234[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[redacted phone]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\b(token|api[_-]?key|authorization|password|secret)\s*[:=]\s*["']?[^,\s"'&}]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function providerResponseSummary(value: unknown, phone: string, depth = 0): unknown {
  if (typeof value === "string") return redactProviderText(value, phone);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (!value || typeof value !== "object" || depth >= 3) return "[omitted]";
  if (Array.isArray(value)) {
    return value.slice(0, 3).map((item) => providerResponseSummary(item, phone, depth + 1));
  }

  const summary: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (PROVIDER_DIAGNOSTIC_KEYS.has(key.toLowerCase())) {
      summary[key] = providerResponseSummary(item, phone, depth + 1);
    }
  }
  return Object.keys(summary).length > 0 ? summary : "[response fields omitted]";
}

export async function purchaseAirtime(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  if (!input || typeof input !== "object") return fail(INVALID);

  const { networkId, typeId, amount, phone, reference, skipNetworkCheck, useCashback } = input as Record<string, unknown>;
  const allowMismatch = skipNetworkCheck === true;
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

  const mismatchError = !allowMismatch ? networkMismatchMessage(phone, networkId, quote.networkName) : null;
  if (mismatchError) return fail(mismatchError);

  const price = airtimePrice(amount, quote.discount);
  if (!Number.isFinite(price) || price <= 0) return fail(UNAVAILABLE);
  const cost = quote.providerDiscount === null ? null : round2(amount * (1 - quote.providerDiscount / 100));

  const providerId = await pickAirtimeProvider(quote.providerId);
  if (!providerId) return fail("Airtime can't be bought right now. Please try again later.");

  const charge = await quoteCharge(user.sub, price, useCashback === true);
  const balance = await getNairaBalance(user.sub);
  if (balance !== null && balance < charge.walletPart) {
    return fail(`Your wallet balance is ${formatNaira(balance)}. Fund your wallet or use cashback to buy this airtime.`);
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
    cashbackUsed: charge.cashbackUsed,
  });
  if (!started) return fail("That purchase is already being processed. Check your history.");
  const vars = { name: firstName(user.name), item: title, amount: formatNaira(price), recipient: groupPhone(phone) };

  let debited = false;
  try {
    debited = await takePayment(user.sub, charge, reference);
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
    if (outcome !== "success") {
      const payload = (result.data as Record<string, unknown> | null) ?? null;
      console.warn("[airtime-purchase] Provider returned a non-success response", reference, {
        providerId,
        httpStatus: result.status,
        outcome,
        response: providerResponseSummary(result.data, phone),
        result: JSON.stringify(payload?.detail ?? null),
      });
    }
  } catch (error) {
    response = error instanceof Error ? error.message : "Provider call failed";
    outcome = error instanceof NotSentError ? "failed" : "pending";
    console.error("[airtime-purchase] Provider call did not complete", reference, error);
  }

  if (outcome === "success") {
    await finishTransaction(reference, "success", { response });
    await onPurchaseSuccess(reference);
    revalidatePath("/dashboard");
    return { ok: true, status: "success", message: await purchaseMessage("airtime", "success", vars) };
  }

  if (outcome === "failed") {
    await finishTransaction(reference, "failed", { reason: REJECTED, response });
    const refunded = await refundAndMark(user.sub, price, charge.cashbackUsed, reference);
    revalidatePath("/dashboard");
    return fail(await purchaseMessage("airtime", "failed", { ...vars, refund_note: refundNote(refunded) }));
  }

  await finishTransaction(reference, "pending", { response });
  revalidatePath("/dashboard");
  return { ok: true, status: "pending", message: await purchaseMessage("airtime", "pending", vars) };
}
