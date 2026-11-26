import "server-only";
import { getPool } from "@/lib/db";
import type { TxService, TxStatus } from "@/lib/dashboard-data";

export type Receipt = {
  id: string;
  service: TxService;
  title: string;
  detail: string;
  amount: number;
  cashbackUsed: number;
  direction: "debit" | "credit";
  status: TxStatus;
  at: string;
  failureReason: string | null;
  refunded: boolean;
  debited: boolean;
};

/** Pass a customer id for the owner's view, or null for the public link (the caller checks status). */
export async function getReceipt(id: string, customerId: string | null): Promise<Receipt | null> {
  const { rows } = await getPool().query<{
    id: string;
    service: TxService;
    title: string;
    detail: string;
    amount: string;
    cashback_used: string;
    direction: "debit" | "credit";
    status: TxStatus;
    created_at: Date;
    failure_reason: string | null;
    refunded: boolean;
    debited: boolean;
  }>(
    `select id, service, title, detail, amount, cashback_used, direction, status, created_at,
            failure_reason, refunded, debited
     from transactions
     where id = $1 and ($2::text is null or customer_id = $2)`,
    [id, customerId],
  );
  const r = rows[0];
  return r
    ? {
        id: r.id,
        service: r.service,
        title: r.title,
        detail: r.detail,
        amount: Number(r.amount),
        cashbackUsed: Number(r.cashback_used),
        direction: r.direction,
        status: r.status,
        at: r.created_at.toISOString(),
        failureReason: r.failure_reason,
        refunded: r.refunded,
        debited: r.debited,
      }
    : null;
}
