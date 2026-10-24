import type { TxService, TxStatus } from "@/lib/dashboard-data";

export type AdminTransaction = {
  id: string;
  service: TxService;
  title: string;
  /** Who made it, shown as @username */
  username: string;
  amount: number;
  direction: "debit" | "credit";
  status: TxStatus;
  /** ISO timestamp */
  at: string;
};

export type AdminOverview = {
  users: { total: number; newThisWeek: number };
  walletFloat: number;
  today: { revenue: number; transactions: number; successRate: number /* 0..1 */ };
  attention: { pending: number; failed: number };
  revenueByService: { label: string; amount: number }[];
  monthRevenue: number;
  recent: AdminTransaction[];
};

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/**
 * Sample data. Replace the body with your real queries (user count, summed
 * wallet balances, today's sales, pending/failed counts, this month's revenue
 * by service, latest transactions across all users).
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  return {
    users: { total: 1284, newThisWeek: 47 },
    walletFloat: 2_845_300,
    today: { revenue: 186_500, transactions: 212, successRate: 0.968 },
    attention: { pending: 4, failed: 7 },
    monthRevenue: 3_920_000,
    revenueByService: [
      { label: "Data", amount: 1_640_000 },
      { label: "Airtime", amount: 1_120_000 },
      { label: "Electricity", amount: 720_000 },
      { label: "Cable TV", amount: 440_000 },
    ],
    recent: [
      { id: "a1", service: "data", title: "2GB data bundle", username: "jane", amount: 1000, direction: "debit", status: "success", at: ago(3) },
      { id: "a2", service: "wallet", title: "Wallet funding", username: "tunde", amount: 20000, direction: "credit", status: "success", at: ago(11) },
      { id: "a3", service: "airtime", title: "Airtime", username: "amaka", amount: 500, direction: "debit", status: "pending", at: ago(18) },
      { id: "a4", service: "cable", title: "Cable TV renewal", username: "chidi", amount: 4500, direction: "debit", status: "failed", at: ago(42) },
      { id: "a5", service: "electricity", title: "Electricity token", username: "bola", amount: 3000, direction: "debit", status: "success", at: ago(75) },
      { id: "a6", service: "data", title: "5GB data bundle", username: "sade", amount: 2500, direction: "debit", status: "failed", at: ago(130) },
    ],
  };
}
