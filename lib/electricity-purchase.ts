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
  discount: number;
};

export const electricityPrice = (amount: number, discount: number) =>
  Math.round(amount * (1 - discount / 100) * 100) / 100;
