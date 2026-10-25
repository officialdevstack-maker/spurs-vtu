export const AIRTIME_PATH = "/dashboard/airtime";

/** Shortcuts shown on the page. Only amounts inside an active discount range appear. */
export const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export type AirtimeRange = { min: number; max: number; discount: number };
export type AirtimeCatalogType = { id: string; label: string; ranges: AirtimeRange[] };
export type AirtimeCatalogNetwork = { id: string; name: string; types: AirtimeCatalogType[] };

/** What the customer pays for `amount` of airtime at `discount` percent off. */
export const airtimePrice = (amount: number, discount: number) =>
  Math.round(amount * (1 - discount / 100) * 100) / 100;

export const findRange = (ranges: AirtimeRange[], amount: number) =>
  ranges.find((range) => amount >= range.min && amount <= range.max) ?? null;
