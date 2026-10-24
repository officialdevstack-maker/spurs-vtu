/** Ids are slugs generated from the name, e.g. "9mobile". */
export type NetworkId = string;
export type DataType = string;

export type DataTypeOption = { id: DataType; label: string };

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
  /** Percent off airtime, 0..100 */
  airtimeDiscount: number;
  enabledTypes: DataType[];
  plans: DataPlan[];
  airtimePins: PinStock[];
  dataPins: PinStock[];
};

export type AirtimeDataProducts = { networks: NetworkProduct[]; types: DataTypeOption[] };

export const typeLabel = (types: DataTypeOption[], id: DataType) =>
  types.find((t) => t.id === id)?.label ?? id.toUpperCase();

/** "9mobile" -> "9mobile", "Smile 4G" -> "smile-4g" */
export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
