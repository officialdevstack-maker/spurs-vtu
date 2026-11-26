export const ELECTRICITY_PATH = "/dashboard/electricity";

export const METER_PATTERN = /^\d{10,13}$/;

export const METER_TYPES = [
  { id: "prepaid", label: "Prepaid" },
  { id: "postpaid", label: "Postpaid" },
] as const;
export type MeterType = (typeof METER_TYPES)[number]["id"];

export const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];

export type ElectricityDisco = {
  id: string;
  name: string;
  min: number;
  max: number;
  /** What this customer's package gets off. */
  discount: number;
  /** What the standard rate gets off, so the page can show a better package rate. */
  standardDiscount: number;
};

export type MeterLookup =
  | { status: "found"; name: string; address: string | null; balance: number | null }
  | { status: "invalid" }
  | { status: "unavailable" };

export const electricityPrice = (amount: number, discount: number) =>
  Math.round(amount * (1 - discount / 100) * 100) / 100;
