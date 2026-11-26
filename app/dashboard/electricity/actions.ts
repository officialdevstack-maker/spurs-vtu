"use server";

import { requireSpursUser } from "@/lib/spurs";
import { getElectricityQuote, pickElectricityProvider } from "@/lib/db/electricity";
import { METER_PATTERN, METER_TYPES, electricityPrice, type MeterLookup } from "@/lib/electricity-purchase";
import type { PurchaseResult } from "@/lib/data-purchase";
import { formatNumber } from "@/lib/format";
import { lookupMeter } from "@/lib/meter-lookup";
import { PHONE_PATTERN } from "@/lib/phone";
import { mappedText } from "@/lib/providers/response-map";
import {
  BAD_PHONE,
  executePurchase,
  INVALID_PURCHASE,
  openPurchase,
  purchaseFail,
  REFERENCE,
} from "@/lib/purchase/execute";

const MAX_AMOUNT = 1_000_000;
const UNAVAILABLE = "That amount isn't available for this disco any more. Refresh the page.";
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

export async function checkMeter(input: unknown): Promise<MeterLookup> {
  await requireSpursUser();
  if (!input || typeof input !== "object") return { status: "unavailable" };
  const { discoId, meterType, meter } = input as Record<string, unknown>;
  const type = METER_TYPES.find((item) => item.id === meterType);
  if (
    typeof discoId !== "string" ||
    !/^[a-z0-9-]{1,60}$/.test(discoId) ||
    !type ||
    typeof meter !== "string" ||
    !METER_PATTERN.test(meter)
  ) {
    return { status: "unavailable" };
  }
  return lookupMeter(discoId, type.id, meter);
}

export async function purchaseElectricity(input: unknown): Promise<PurchaseResult> {
  const user = await requireSpursUser();
  if (!input || typeof input !== "object") return purchaseFail(INVALID_PURCHASE);

  const { discoId, meterType, meter, amount, phone, reference, useCashback, promoCode, pin } = input as Record<string, unknown>;
  const type = METER_TYPES.find((item) => item.id === meterType);
  if (
    typeof discoId !== "string" ||
    !discoId ||
    !type ||
    typeof reference !== "string" ||
    !REFERENCE.test(reference) ||
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    amount > MAX_AMOUNT
  ) {
    return purchaseFail(INVALID_PURCHASE);
  }
  if (typeof meter !== "string" || !METER_PATTERN.test(meter)) {
    return purchaseFail("Enter your meter number, 10 to 13 digits.");
  }
  if (typeof phone !== "string" || !PHONE_PATTERN.test(phone)) return purchaseFail(BAD_PHONE);

  const opened = await openPurchase("electricity", user.sub, reference, pin);
  if ("result" in opened) return opened.result;

  const quote = await getElectricityQuote(discoId, amount, opened.customer.packageId);
  if (!quote) return purchaseFail(UNAVAILABLE);

  const price = electricityPrice(amount, quote.discount);
  if (!Number.isFinite(price) || price <= 0) return purchaseFail(UNAVAILABLE);
  const cost = quote.providerDiscount === null ? null : round2(amount * (1 - quote.providerDiscount / 100));

  const providerId = await pickElectricityProvider(quote.providerId);
  if (!providerId) return purchaseFail("Electricity can't be bought right now. Please try again later.");

  const check = await lookupMeter(discoId, type.id, meter, providerId);
  if (check.status === "invalid") return purchaseFail("We couldn't find that meter number. Check it and try again.");
  const holder = check.status === "found" ? check.name : null;

  return executePurchase({
    service: "electricity",
    reference,
    user,
    useCashback: useCashback === true,
    price,
    cost,
    title: `₦${formatNumber(amount)} ${quote.name} ${type.label.toLowerCase()} electricity`,
    detail: holder ? `Meter ${meter} · ${holder}` : `Meter ${meter}`,
    networkId: null,
    planId: null,
    providerId,
    phone,
    recipient: meter,
    providerService: "electricity",
    providerVars: { disco: quote.providerCode || discoId, meter, type: type.id, amount, phone, reference },
    promoCode: typeof promoCode === "string" && promoCode.trim() ? promoCode : null,
    inspect: (result) => {
      const token = mappedText(result, "token") ?? findToken(result.data);
      return {
        token_note: token ? ` Token: ${token}` : type.id === "prepaid" ? " Your token will be sent to your phone." : "",
      };
    },
  });
}
