import type { PackagePrice } from "@/lib/admin/airtime-data";

export type CablePlan = {
  id: string;
  /** Bouquet name, e.g. "DStv Compact" */
  name: string;
  validity: string;
  /** What you pay the provider */
  cost: number;
  /** What the customer pays */
  price: number;
  /** Per-package selling prices. A package not listed pays `price`. */
  packagePrices: PackagePrice[];
  /** Provider that fulfils this plan. null means any provider by priority. */
  providerId: string | null;
  providerName: string | null;
  /** The provider's own ID for this bouquet, sent as {plan}. */
  providerPlanId: string;
  active: boolean;
};

export type CableOperator = {
  id: string;
  name: string;
  enabled: boolean;
  plans: CablePlan[];
};

export const CABLE_PATH = "/admin/products/cable-tv";
export const operatorUrl = (operator: string) => `${CABLE_PATH}?operator=${encodeURIComponent(operator)}`;
export const newCablePlanUrl = (operator: string) =>
  `${CABLE_PATH}/plans/new?operator=${encodeURIComponent(operator)}`;
export const editCablePlanUrl = (id: string) => `${CABLE_PATH}/plans/${encodeURIComponent(id)}`;
