export const DATA_PATH = "/dashboard/data";

export type CatalogType = { id: string; label: string };

export type CatalogPlan = {
  id: string;
  typeId: string;
  size: string;
  validity: string;
  price: number;
  standardPrice: number;
};

export type CatalogNetwork = {
  id: string;
  name: string;
  types: CatalogType[];
  plans: CatalogPlan[];
};

export type PurchaseResult =
  | { ok: true; status: "success" | "pending"; message: string }
  | { ok: false; error: string };
