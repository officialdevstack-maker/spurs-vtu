import type { Transaction } from "@/lib/dashboard-data";
import type { AuditRecord } from "@/lib/admin/audit";
import type { FraudAction, FraudRuleId } from "@/lib/admin/fraud";
import type { TicketRow } from "@/lib/admin/support";

export type CustomerFlag = {
  id: string;
  rule: FraudRuleId;
  action: FraudAction;
  status: "open" | "reviewed";
  resolution: "dismissed" | "confirmed" | null;
  at: string;
};

export type CustomerDetail = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  status: "active" | "suspended";
  createdAt: string;
  lastSeenAt: string;
  packageId: string;
  packageName: string;
  fraudExempt: boolean;
  referralCode: string | null;
  isStaff: boolean;
  walletBalance: number;
  cashbackBalance: number;
  pin: { hasPin: boolean; lockedUntil: string | null };
  spend: { purchases: number; total: number };
  transactions: Transaction[];
  referral: { referrer: string | null; status: "pending" | "rewarded" | null; invited: number; rewarded: number };
  tickets: TicketRow[];
  flags: CustomerFlag[];
  audit: AuditRecord[];
};

export const CUSTOMER_DETAIL_PATH = "/admin/users";
export const customerUrl = (id: string) => `${CUSTOMER_DETAIL_PATH}/${encodeURIComponent(id)}`;
