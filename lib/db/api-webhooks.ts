import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";

export type ApiWebhook = { url: string; enabled: boolean; updatedAt: string };
export type WebhookDelivery = { id: string; event: string; reference: string; status: "pending" | "delivered" | "failed"; attempts: number; httpStatus: number | null; lastError: string | null; at: string };
export type ClaimedDelivery = { id: string; event: string; payload: string; attempts: number; url: string | null; secret_enc: string | null; enabled: boolean | null };

const changed = (r: { rowCount: number | null }) => (r.rowCount ?? 0) > 0;

export async function getApiWebhook(customerId: string): Promise<ApiWebhook | null> {
  const { rows } = await getPool().query<{ url: string; enabled: boolean; updated_at: Date }>(
    "select url, enabled, updated_at from api_webhooks where customer_id = $1", [customerId],
  );
  const row = rows[0];
  return row ? { url: row.url, enabled: row.enabled, updatedAt: row.updated_at.toISOString() } : null;
}

export async function createApiWebhook(customerId: string, url: string, secretEnc: string): Promise<boolean> {
  return changed(await getPool().query(
    `insert into api_webhooks (customer_id, url, secret_enc) values ($1, $2, $3) on conflict (customer_id) do nothing`,
    [customerId, url, secretEnc],
  ));
}

export async function updateApiWebhook(customerId: string, url: string, enabled: boolean): Promise<boolean> {
  return changed(await getPool().query(
    "update api_webhooks set url = $2, enabled = $3, updated_at = now() where customer_id = $1",
    [customerId, url, enabled],
  ));
}

export async function setApiWebhookSecret(customerId: string, secretEnc: string): Promise<boolean> {
  return changed(await getPool().query(
    "update api_webhooks set secret_enc = $2, updated_at = now() where customer_id = $1",
    [customerId, secretEnc],
  ));
}

export async function deleteApiWebhook(customerId: string): Promise<boolean> {
  return changed(await getPool().query("delete from api_webhooks where customer_id = $1", [customerId]));
}

export async function enqueueOrderEvent(transactionId: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string; customer_id: string; status: "success" | "failed"; title: string;
    amount: string; failure_reason: string | null; refunded: boolean; created_at: Date;
  }>(`select t.id, t.customer_id, t.status, t.title, t.amount, t.failure_reason, t.refunded, t.created_at
      from transactions t join api_webhooks w on w.customer_id = t.customer_id and w.enabled
      where t.id = $1 and t.direction = 'debit' and t.status in ('success', 'failed')`, [transactionId]);
  const tx = rows[0];
  if (!tx) return false;
  const event = tx.status === "success" ? "order.success" : "order.failed";
  const payload = JSON.stringify({
    event, reference: tx.id, status: tx.status, title: tx.title, amount: Number(tx.amount),
    refunded: tx.status === "failed" ? tx.refunded : null,
    failureReason: tx.status === "failed" ? tx.failure_reason : null,
    createdAt: tx.created_at.toISOString(),
  });
  return changed(await pool.query(
    `insert into api_webhook_deliveries (id, customer_id, transaction_id, event, payload)
     values ($1, $2, $3, $4, $5) on conflict (transaction_id, event) do nothing`,
    [randomUUID(), tx.customer_id, tx.id, event, payload],
  ));
}

export async function claimDueDeliveries(limit: number): Promise<ClaimedDelivery[]> {
  const { rows } = await getPool().query<ClaimedDelivery>(
    `update api_webhook_deliveries d
     set attempts = d.attempts + 1, next_attempt_at = now() + interval '3 minutes'
     from (
       select id, customer_id from api_webhook_deliveries
       where status = 'pending' and next_attempt_at <= now()
       order by next_attempt_at limit $1 for update skip locked
     ) due left join api_webhooks w on w.customer_id = due.customer_id
     where d.id = due.id
     returning d.id, d.event, d.payload, d.attempts, w.url, w.secret_enc, w.enabled`,
    [limit],
  );
  return rows;
}

export async function markDelivered(id: string, httpStatus: number): Promise<void> {
  await getPool().query(
    `update api_webhook_deliveries set status = 'delivered', delivered_at = now(),
     http_status = $2, last_error = null where id = $1`, [id, httpStatus],
  );
}

export async function markAttemptFailed(id: string, error: string, httpStatus: number | null, retryInSeconds: number | null): Promise<void> {
  await getPool().query(
    `update api_webhook_deliveries
     set status = case when $4::int is null then 'failed' else 'pending' end,
         next_attempt_at = now() + make_interval(secs => coalesce($4::int, 0)),
         last_error = $2, http_status = $3 where id = $1`,
    [id, error, httpStatus, retryInSeconds],
  );
}

export async function listRecentDeliveries(customerId: string, limit = 10): Promise<WebhookDelivery[]> {
  const { rows } = await getPool().query<{
    id: string; event: string; transaction_id: string; status: WebhookDelivery["status"];
    attempts: number; http_status: number | null; last_error: string | null; created_at: Date;
  }>(`select id, event, transaction_id, status, attempts, http_status, last_error, created_at
      from api_webhook_deliveries where customer_id = $1 order by created_at desc limit $2`,
  [customerId, limit]);
  return rows.map((r) => ({
    id: r.id, event: r.event, reference: r.transaction_id, status: r.status,
    attempts: r.attempts, httpStatus: r.http_status, lastError: r.last_error, at: r.created_at.toISOString(),
  }));
}
