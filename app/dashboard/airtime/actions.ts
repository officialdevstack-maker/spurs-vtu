"use server";

import { requireSpursUser } from "@/lib/spurs";
import { airtimePrice } from "@/lib/airtime-purchase";
import { getAirtimeQuote, pickAirtimeProvider } from "@/lib/db/airtime-purchase";
import type { PurchaseResult } from "@/lib/data-purchase";
import { formatNumber } from "@/lib/format";
import { networkMismatchMessage } from "@/lib/network-prefix";
import { PHONE_PATTERN, groupPhone } from "@/lib/phone";
import { airtimeAlternates } from "@/lib/db/failover";
import {
  BAD_PHONE,
  executePurchase,
  INVALID_PURCHASE,
  openPurchase,
  purchaseFail,
  REFERENCE,
} from "@/lib/purchase/execute";

const MAX_AMOUNT = 1_000_000;
const UNAVAILABLE = "That amount isn't available for this network any more. Refresh the page.";
const round2 = (value: number) => Math.round(value * 100) / 100;

export async function purchaseAirtime(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  if (!input || typeof input !== "object") return purchaseFail(INVALID_PURCHASE);

  const { networkId, typeId, amount, phone, reference, skipNetworkCheck, useCashback, promoCode, pin } = input as Record<string, unknown>;
  if (
    typeof networkId !== "string" ||
    !networkId ||
    typeof typeId !== "string" ||
    !typeId ||
    typeof reference !== "string" ||
    !REFERENCE.test(reference) ||
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    amount > MAX_AMOUNT
  ) {
    return purchaseFail(INVALID_PURCHASE);
  }
  if (typeof phone !== "string" || !PHONE_PATTERN.test(phone)) return purchaseFail(BAD_PHONE);

  const opened = await openPurchase("airtime", user.sub, reference, pin);
  if ("result" in opened) return opened.result;

  const quote = await getAirtimeQuote(networkId, typeId, amount);
  if (!quote) return purchaseFail(UNAVAILABLE);

  const mismatch = skipNetworkCheck === true ? null : networkMismatchMessage(phone, networkId, quote.networkName);
  if (mismatch) return purchaseFail(mismatch);

  const price = airtimePrice(amount, quote.discount);
  if (!Number.isFinite(price) || price <= 0) return purchaseFail(UNAVAILABLE);
  const cost = quote.providerDiscount === null ? null : round2(amount * (1 - quote.providerDiscount / 100));

  const providerId = await pickAirtimeProvider(quote.providerId);
  if (!providerId) return purchaseFail("Airtime can't be bought right now. Please try again later.");

  const recipient = groupPhone(phone);
  const providerVars = { phone, amount, network: networkId, type: quote.typeLabel, reference };
  const alternates = await airtimeAlternates(providerId, providerVars);
  return executePurchase({
    service: "airtime",
    reference,
    user,
    useCashback: useCashback === true,
    price,
    cost,
    title: `₦${formatNumber(amount)} ${quote.networkName} ${quote.typeLabel} airtime`,
    detail: recipient,
    networkId,
    planId: null,
    providerId,
    phone,
    recipient,
    providerService: "airtime",
    providerVars,
    alternates,
    promoCode: typeof promoCode === "string" && promoCode.trim() ? promoCode : null,
  });
}
