import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import {
  AUTO_FAIL_KEY,
  MAX_MINUTES,
  MIN_AUTO_FAIL_MINUTES,
  type PendingSummary,
  type WebhookEvent,
  type WebhookOutcome,
  type WebhookResult,
} from "@/lib/admin/webhooks";

const TOKEN_SQL = "replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')";
const changed = (result: { rowCount: number | null }) => (result.rowCount ?? 0) > 0;

export async function getProviderByToken(token: string): Promise<{ id: string; name: string } | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await getPool().query<{ id: string; name: string }>(
    "select id, name from providers where webhook_token = $1",
    [token],
  );
  return rows[0] ?? null;
}

export async function listProviderWebhooks() {
  const { rows } = await getPool().query<{
    id: string;
    name: string;
    enabled: boolean;
    webhook_token: string;
  }>("select id, name, enabled, webhook_token from providers order by priority, name");
  return rows.map((row) => ({ id: row.id, name: row.name, enabled: row.enabled, token: row.webhook_token }));
}

export async function regenerateWebhookToken(providerId: string): Promise<boolean> {
  return changed(
    await getPool().query(`update providers set webhook_token = ${TOKEN_SQL}, updated_at = now() where id = $1`, [
      providerId,
    ]),
  );
}

export async function logWebhookEvent(event: {
  providerId: string;
  reference: string | null;
  outcome: WebhookOutcome;
  result: WebhookResult;
  payload: string;
}): Promise<void> {
  await getPool().query(
    `insert into provider_webhook_events (id, provider_id, reference, outcome, result, payload)
     values ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), event.providerId, event.reference, event.outcome, event.result, event.payload.slice(0, 2000)],
  );
}

export async function listWebhookEvents(limit = 15): Promise<WebhookEvent[]> {
  const { rows } = await getPool().query<{
    id: string;
    provider_name: string;
    reference: string | null;
    outcome: WebhookOutcome;
    result: WebhookResult;
    created_at: Date;
  }>(
    `select e.id, p.name as provider_name, e.reference, e.outcome, e.result, e.created_at
     from provider_webhook_events e
     join providers p on p.id = e.provider_id
     order by e.created_at desc, e.id
     limit $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    providerName: row.provider_name,
    reference: row.reference,
    outcome: row.outcome,
    result: row.result,
    at: row.created_at.toISOString(),
  }));
}

export async function getPendingSummary(): Promise<PendingSummary> {
  const { rows } = await getPool().query<{ count: string; oldest: Date | null }>(
    `select count(*)::text as count, min(created_at) as oldest
     from transactions where status = 'pending' and direction = 'debit'`,
  );
  const row = rows[0];
  return { count: Number(row?.count ?? 0), oldest: row?.oldest ? row.oldest.toISOString() : null };
}

/** Minutes after which pending purchases fail on their own. 0 means off. */
export async function getAutoFailMinutes(): Promise<number> {
  const { rows } = await getPool().query<{ value: string }>("select value from app_settings where key = $1", [
    AUTO_FAIL_KEY,
  ]);
  const value = rows[0]?.value;
  if (value === undefined) return 0;
  const minutes = Number(value);
  if (
    !Number.isInteger(minutes) ||
    (minutes !== 0 && (minutes < MIN_AUTO_FAIL_MINUTES || minutes > MAX_MINUTES))
  ) {
    throw new Error("The saved auto-fail setting is invalid. Correct it from the Webhooks page.");
  }
  return minutes;
}

export async function setAutoFailMinutes(minutes: number): Promise<void> {
  await getPool().query(
    `insert into app_settings (key, value) values ($1, $2)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [AUTO_FAIL_KEY, String(minutes)],
  );
}
