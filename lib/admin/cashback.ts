export type CashbackService = "airtime" | "data" | "cable" | "electricity";

export const CASHBACK_SERVICES: { id: CashbackService; label: string }[] = [
  { id: "data", label: "Data" },
  { id: "cable", label: "Cable TV" },
  { id: "airtime", label: "Airtime" },
  { id: "electricity", label: "Electricity" },
];

export type CashbackRule = {
  service: CashbackService;
  enabled: boolean;
  percent: number;
  minSpend: number;
  monthlyCap: number | null;
};

export type CashbackSettings = { enabled: boolean; rules: CashbackRule[] };

export const MAX_CASHBACK_PERCENT = 10;
export const CASHBACK_PATH = "/admin/products/cashback";
export const CUSTOMER_CASHBACK_PATH = "/dashboard/bonus";
export const CASHBACK_ACTIVITY_PATH = "/admin/products/cashback/activity";

export type CashbackEntry = {
  id: string;
  direction: "credit" | "debit";
  amount: number;
  source: "earn" | "spend" | "restore" | "referral" | "adjust";
  at: string;
};

export type AdminCashbackEntry = CashbackEntry & {
  customer: string;
  note: string | null;
};
