/** Ids are slugs generated from the name, e.g. "9mobile". */
export type NetworkId = string;
export type DataType = string;
export type Service = "airtime" | "data";

export const SERVICES: { id: Service; label: string }[] = [
  { id: "airtime", label: "Airtime" },
  { id: "data", label: "Data" },
];

export type DataTypeOption = { id: DataType; label: string; service: Service };

export type AirtimeDiscount = {
  id: string;
  type: DataType;
  min: number;
  max: number;
  discount: number;
  active: boolean;
};

export type DataPlan = {
  id: string;
  type: DataType;
  size: string;
  validity: string;
  /** What you pay the provider */
  cost: number;
  /** What the customer pays */
  price: number;
  active: boolean;
};

export type PinStock = {
  id: string;
  label: string;
  price: number;
  available: number;
  used: number;
};

export type NetworkProduct = {
  id: NetworkId;
  name: string;
  enabled: boolean;
  enabledTypes: DataType[];
  plans: DataPlan[];
  discounts: AirtimeDiscount[];
  airtimePins: PinStock[];
  dataPins: PinStock[];
};

export type AirtimeDataProducts = { networks: NetworkProduct[]; types: DataTypeOption[] };

export const AIRTIME_DATA_PATH = "/admin/products/airtime-data";
export const discountsUrl = (network: string) =>
  `${AIRTIME_DATA_PATH}?network=${encodeURIComponent(network)}&tab=discounts`;
export const newDiscountUrl = (network: string) =>
  `${AIRTIME_DATA_PATH}/discounts/new?network=${encodeURIComponent(network)}`;
export const editDiscountUrl = (id: string) => `${AIRTIME_DATA_PATH}/discounts/${encodeURIComponent(id)}`;

export const typeLabel = (types: DataTypeOption[], id: DataType) =>
  types.find((t) => t.id === id)?.label ?? id.toUpperCase();

/** "9mobile" -> "9mobile", "Smile 4G" -> "smile-4g" */
export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
