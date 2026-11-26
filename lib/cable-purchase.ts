export const CABLE_PATH = "/dashboard/cable";

/** DStv and GOtv use 10 digits, StarTimes uses 11. */
export const SMARTCARD_PATTERN = /^\d{10,11}$/;

export type CableCatalogPlan = {
  id: string;
  name: string;
  validity: string;
  price: number;
  standardPrice: number;
};

export type CableCatalogOperator = {
  id: string;
  name: string;
  plans: CableCatalogPlan[];
};
