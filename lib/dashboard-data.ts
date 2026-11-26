export type TxService = "airtime" | "data" | "cable" | "electricity" | "wallet";
export type TxStatus = "success" | "pending" | "failed";

export type Transaction = {
  id: string;
  service: TxService;
  title: string;
  detail: string;
  amount: number;
  direction: "debit" | "credit";
  status: TxStatus;
  /** ISO timestamp */
  at: string;
};

export type DashboardData = {
  user: { firstName: string; verified: boolean };
  wallet: { balance: number };
  bonus: { balance: number };
  package: {
    name: string;
    perks: string[];
    next?: { name: string; remaining: number; progress: number /* 0..1 */ };
  };
  transactions: Transaction[];
  spend: { total: number; byService: { label: string; amount: number }[] };
};