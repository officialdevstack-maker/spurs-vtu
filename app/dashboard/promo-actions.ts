"use server";

import { isPromoService } from "@/lib/admin/promotions";
import { quotePromo } from "@/lib/promotions";
import { requireSpursUser } from "@/lib/spurs";

export type PromoPreview =
  | { ok: true; code: string; discount: number; finalPrice: number }
  | { ok: false; error: string };

export async function previewPromo(input: unknown): Promise<PromoPreview> {
  const user = await requireSpursUser();
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const { code, service, price } = raw;
  if (
    typeof code !== "string" || code.length > 40 ||
    !isPromoService(service) ||
    typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 10_000_000
  ) {
    return { ok: false, error: "Enter a valid code." };
  }
  const quote = await quotePromo({ code, customerId: user.sub, service, price, cost: null });
  return quote.ok
    ? { ok: true, code: quote.code, discount: quote.discount, finalPrice: quote.finalPrice }
    : quote;
}
