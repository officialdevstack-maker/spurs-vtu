/** A package's own customer discount for a disco. A package not listed gets the disco's standard discount. */
export type PackageDiscount = { packageId: string; discount: number };

export type Disco = {
  id: string;
  name: string;
  providerCode: string;
  enabled: boolean;
  /** Standard customer discount, in percent. */
  discount: number;
  packageDiscounts: PackageDiscount[];
  providerId: string | null;
  providerName: string | null;
  providerDiscount: number | null;
  minAmount: number;
  maxAmount: number;
};

export const ELECTRICITY_PATH = "/admin/products/electricity";

/** The discount a customer on `packageId` gets. */
export const resolveDiscount = (standard: number, overrides: PackageDiscount[], packageId: string) =>
  overrides.find((item) => item.packageId === packageId)?.discount ?? standard;
