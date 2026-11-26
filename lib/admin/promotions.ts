export type PromoKind = "percent" | "fixed";
export type PromoService = "airtime" | "data" | "cable" | "electricity";

export type Promo = {
  id: string;
  code: string;
  description: string;
  kind: PromoKind;
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  services: PromoService[];
  totalLimit: number | null;
  perCustomerLimit: number;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  used: number;
};

export type PromoFields = Omit<Promo, "id" | "used">;

export const PROMOTIONS_PATH = "/admin/products/promotions";
export const CODE_PATTERN = /^[A-Z0-9]{4,20}$/;
export const MIN_PAYABLE = 1;

export const PROMO_SERVICES: { id: PromoService; label: string }[] = [
  { id: "airtime", label: "Airtime" },
  { id: "data", label: "Data" },
  { id: "cable", label: "Cable TV" },
  { id: "electricity", label: "Electricity" },
];

export const isPromoService = (value: unknown): value is PromoService =>
  PROMO_SERVICES.some((service) => service.id === value);

export const normalizeCode = (value: string) => value.replace(/\s+/g, "").toUpperCase();
const round2 = (value: number) => Math.round(value * 100) / 100;

export function computeDiscount(
  price: number,
  promo: Pick<Promo, "kind" | "value" | "maxDiscount">,
  cost: number | null = null,
): number {
  let discount = promo.kind === "percent" ? (price * promo.value) / 100 : promo.value;
  if (promo.maxDiscount !== null) discount = Math.min(discount, promo.maxDiscount);
  discount = Math.min(discount, price - Math.max(MIN_PAYABLE, cost ?? 0));
  return discount > 0 ? round2(discount) : 0;
}
