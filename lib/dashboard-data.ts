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

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/**
 * Sample data. Replace the body with your real queries (wallet, bonus,
 * package, last five transactions, this month's spend by service).
 */
export async function getDashboardData(): Promise<DashboardData> {
  return {
    user: { firstName: "Jane", verified: false },
    wallet: { balance: 12450 },
    bonus: { balance: 1530 },
    package: {
      name: "Starter",
      perks: ["Standard rates on every service", "Instant delivery", "Bonus on every purchase"],
      next: { name: "Agent", remaining: 38000, progress: 0.24 },
    },
    transactions: [
      { id: "t1", service: "data", title: "2GB data bundle", detail: "0803 000 0001", amount: 1000, direction: "debit", status: "success", at: ago(22) },
      { id: "t2", service: "wallet", title: "Wallet funding", detail: "Bank transfer", amount: 5000, direction: "credit", status: "success", at: ago(150) },
      { id: "t3", service: "airtime", title: "Airtime", detail: "0803 000 0002", amount: 500, direction: "debit", status: "pending", at: ago(60 * 20) },
      { id: "t4", service: "electricity", title: "Electricity token", detail: "Meter 4512 •••• 0987", amount: 3000, direction: "debit", status: "success", at: ago(60 * 30) },
      { id: "t5", service: "cable", title: "Cable TV renewal", detail: "Decoder 7021 •••• 441", amount: 4500, direction: "debit", status: "failed", at: ago(60 * 24 * 4) },
    ],
    spend: {
      total: 38400,
      byService: [
        { label: "Data", amount: 14500 },
        { label: "Electricity", amount: 12000 },
        { label: "Cable TV", amount: 7900 },
        { label: "Airtime", amount: 4000 },
      ],
    },
  };
}