import "server-only";
import { CODE_PATTERN, computeDiscount, normalizeCode, type PromoService } from "@/lib/admin/promotions";
import { countCustomerUses, getPromoByCode } from "@/lib/db/promotions";
import { formatNaira } from "@/lib/format";

export type PromoQuote =
  | { ok: true; promoId: string; code: string; discount: number; finalPrice: number }
  | { ok: false; error: string };

const INVALID = "That code isn't valid or has expired.";
const round2 = (value: number) => Math.round(value * 100) / 100;

export async function quotePromo(input: {
  code: string;
  customerId: string;
  service: PromoService;
  price: number;
  cost: number | null;
}): Promise<PromoQuote> {
  const code = normalizeCode(input.code);
  if (!CODE_PATTERN.test(code)) return { ok: false, error: INVALID };
  const promo = await getPromoByCode(code);
  const now = Date.now();
  if (
    !promo ||
    !promo.active ||
    (promo.startsAt && new Date(promo.startsAt).getTime() > now) ||
    (promo.expiresAt && new Date(promo.expiresAt).getTime() <= now)
  ) {
    return { ok: false, error: INVALID };
  }
  if (promo.services.length > 0 && !promo.services.includes(input.service)) {
    return { ok: false, error: "That code doesn't work on this service." };
  }
  if (input.price < promo.minSpend) {
    return { ok: false, error: `That code needs a purchase of ${formatNaira(promo.minSpend)} or more.` };
  }
  if (promo.totalLimit !== null && promo.used >= promo.totalLimit) {
    return { ok: false, error: "That code has been fully claimed." };
  }
  if ((await countCustomerUses(promo.id, input.customerId)) >= promo.perCustomerLimit) {
    return { ok: false, error: "You've already used that code." };
  }
  const discount = computeDiscount(input.price, promo, input.cost);
  if (discount <= 0) return { ok: false, error: "That code doesn't apply to this purchase." };
  return { ok: true, promoId: promo.id, code: promo.code, discount, finalPrice: round2(input.price - discount) };
}
