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
  /** null when the wallet service can't give a total across all users */
  walletFloat: number | null;
  today: { revenue: number; transactions: number; successRate: number /* 0..1 */ };
  /** Pending and failed purchases from the last 24 hours */
  attention: { pending: number; failed: number };
  revenueByService: { label: string; amount: number }[];
  monthRevenue: number;
  recent: AdminTransaction[];
};
