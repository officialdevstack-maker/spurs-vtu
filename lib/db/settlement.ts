import "server-only";
import { getPool } from "@/lib/db";
import type { TxStatus } from "@/lib/dashboard-data";

export type SettledTransaction = {
  id: string;
  customerId: string;
  amount: number;
  debited: boolean;
  refunded: boolean;
  direction: "debit" | "credit";
};

export type PendingTransactionId = { id: string; createdAt: Date };

/**
 * Moves a transaction out of 'pending' exactly once. Returns null if it was not pending
 * (or, when providerId is given, was not routed to that provider).
 */
export async function settlePending(
  id: string,
  status: Exclude<TxStatus, "pending">,
  details: { reason?: string; response?: string; providerId?: string } = {},
): Promise<SettledTransaction | null> {
  const { rows } = await getPool().query<{
    id: string;
    customer_id: string;
    amount: string;
    debited: boolean;
    refunded: boolean;
    direction: "debit" | "credit";
  }>(
    `update transactions
     set status = $2, failure_reason = $3, provider_response = $4, updated_at = now()
     where id = $1 and status = 'pending' and ($5::text is null or provider_id = $5)
     returning id, customer_id, amount, debited, refunded, direction`,
    [id, status, details.reason ?? null, details.response?.slice(0, 2000) ?? null, details.providerId ?? null],
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        customerId: row.customer_id,
        amount: Number(row.amount),
        debited: row.debited,
        refunded: row.refunded,
        direction: row.direction,
      }
    : null;
}

export async function getTransactionState(id: string, providerId: string): Promise<{ status: TxStatus } | null> {
  const { rows } = await getPool().query<{ status: TxStatus }>(
    "select status from transactions where id = $1 and provider_id = $2",
    [id, providerId],
  );
  return rows[0] ?? null;
}

export async function listPendingIds(
  olderThanMinutes: number,
  after: PendingTransactionId | null,
  limit = 500,
): Promise<PendingTransactionId[]> {
  const { rows } = await getPool().query<{ id: string; created_at: Date }>(
    `select id, created_at from transactions
     where status = 'pending' and direction = 'debit'
       and created_at <= now() - make_interval(mins => $1::int)
       and ($2::timestamptz is null or (created_at, id) > ($2::timestamptz, $3::text))
     order by created_at, id
     limit $4`,
    [olderThanMinutes, after?.createdAt ?? null, after?.id ?? null, limit],
  );
  return rows.map((row) => ({ id: row.id, createdAt: row.created_at }));
}
