import "server-only";
import { getPool } from "@/lib/db";
import type { Transaction, TxService, TxStatus } from "@/lib/dashboard-data";

export type NewTransaction = {
  id: string;
  customerId: string;
  service: TxService;
  title: string;
  detail: string;
  amount: number;
  cost: number | null;
  networkId: string | null;
  planId: string | null;
  providerId: string | null;
  phone: string | null;
};

export async function startTransaction(transaction: NewTransaction): Promise<boolean> {
  const result = await getPool().query(
    `insert into transactions
       (id, customer_id, service, title, detail, amount, cost, network_id, plan_id, provider_id, phone)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (id) do nothing`,
    [
      transaction.id,
      transaction.customerId,
      transaction.service,
      transaction.title,
      transaction.detail,
      transaction.amount,
      transaction.cost,
      transaction.networkId,
      transaction.planId,
      transaction.providerId,
      transaction.phone,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function findTransaction(id: string, customerId: string) {
  const { rows } = await getPool().query<{
    status: TxStatus;
    title: string;
    failure_reason: string | null;
  }>("select status, title, failure_reason from transactions where id = $1 and customer_id = $2", [id, customerId]);
  const row = rows[0];
  return row ? { status: row.status, title: row.title, failureReason: row.failure_reason } : null;
}

export async function markDebited(id: string): Promise<void> {
  await getPool().query("update transactions set debited = true, updated_at = now() where id = $1", [id]);
}

export async function markRefunded(id: string): Promise<void> {
  await getPool().query(
    "update transactions set refunded = true, updated_at = now() where id = $1 and status = 'failed'",
    [id],
  );
}

export async function finishTransaction(
  id: string,
  status: TxStatus,
  details: { reason?: string; response?: string } = {},
): Promise<void> {
  await getPool().query(
    `update transactions
     set status = $2, failure_reason = $3, provider_response = $4, updated_at = now()
     where id = $1 and status = 'pending'`,
    [id, status, details.reason ?? null, details.response?.slice(0, 2000) ?? null],
  );
}

type TransactionRow = {
  id: string;
  service: TxService;
  title: string;
  detail: string;
  amount: string;
  direction: "debit" | "credit";
  status: TxStatus;
  created_at: Date;
};

export async function getRecentTransactions(customerId: string, limit = 5): Promise<Transaction[]> {
  const { rows } = await getPool().query<TransactionRow>(
    `select id, service, title, detail, amount, direction, status, created_at
     from transactions
     where customer_id = $1
     order by created_at desc, id
     limit $2`,
    [customerId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    service: row.service,
    title: row.title,
    detail: row.detail,
    amount: Number(row.amount),
    direction: row.direction,
    status: row.status,
    at: row.created_at.toISOString(),
  }));
}
