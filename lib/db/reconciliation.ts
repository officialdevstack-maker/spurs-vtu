import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";

export type ReconKind = "late_success" | "stuck_pending";
export type ReconResolution = "recharged" | "written_off" | "confirmed_success" | "failed_refunded";

export type ReconItem = {
  id: string;
  transactionId: string;
  kind: ReconKind;
  title: string;
  amount: number;
  customer: string;
  providerName: string | null;
  txStatus: string;
  at: string;
};

export async function openReconciliation(transactionId: string, kind: ReconKind, providerId: string | null) {
  await getPool().query(
    `insert into reconciliation_items (id, transaction_id, kind, provider_id)
     select $1, $2, $3, $4
     where not exists (
       select 1 from reconciliation_items
       where transaction_id = $2 and status = 'open'
     )`,
    [randomUUID(), transactionId, kind, providerId],
  );
}

export async function listOpenReconciliation(limit = 100): Promise<ReconItem[]> {
  const { rows } = await getPool().query<{
    id: string; transaction_id: string; kind: ReconKind; title: string; amount: string;
    username: string | null; name: string | null; provider_name: string | null;
    tx_status: string; created_at: Date;
  }>(
    `select r.id, r.transaction_id, r.kind, t.title, t.amount, c.username, c.name,
            p.name as provider_name, t.status as tx_status, r.created_at
     from reconciliation_items r
     join transactions t on t.id = r.transaction_id
     join customers c on c.id = t.customer_id
     left join providers p on p.id = r.provider_id
     where r.status = 'open'
     order by r.created_at
     limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    kind: r.kind,
    title: r.title,
    amount: Number(r.amount),
    customer: r.username ? `@${r.username}` : (r.name ?? "unknown"),
    providerName: r.provider_name,
    txStatus: r.tx_status,
    at: r.created_at.toISOString(),
  }));
}

export async function getOpenItem(id: string) {
  const { rows } = await getPool().query<{
    id: string; transaction_id: string; kind: ReconKind; provider_id: string | null;
    customer_id: string; amount: string;
  }>(
    `select r.id, r.transaction_id, r.kind, r.provider_id, t.customer_id, t.amount
     from reconciliation_items r join transactions t on t.id = r.transaction_id
     where r.id = $1 and r.status = 'open'`,
    [id],
  );
  const r = rows[0];
  return r
    ? { id: r.id, transactionId: r.transaction_id, kind: r.kind, providerId: r.provider_id,
        customerId: r.customer_id, amount: Number(r.amount) }
    : null;
}

export async function resolveItem(id: string, resolution: ReconResolution, note: string, adminId: string) {
  const { rowCount } = await getPool().query(
    `update reconciliation_items
     set status = 'resolved', resolution = $2, note = $3, resolved_by = $4, resolved_at = now()
     where id = $1 and status = 'open'`,
    [id, resolution, note, adminId],
  );
  return (rowCount ?? 0) > 0;
}

export async function markRecharged(transactionId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `update transactions set status = 'success', failure_reason = null, updated_at = now()
     where id = $1 and status = 'failed'`,
    [transactionId],
  );
  return (rowCount ?? 0) > 0;
}

export async function getTransactionProviderId(id: string): Promise<string | null> {
  const { rows } = await getPool().query<{ provider_id: string | null }>(
    "select provider_id from transactions where id = $1 and status = 'pending'",
    [id],
  );
  return rows[0]?.provider_id ?? null;
}
