import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";

const MAX_DEVICES = 10;

export type WebSubscription = { endpoint: string; p256dh: string; auth: string };

export async function saveSubscription(customerId: string, sub: WebSubscription, userAgent: string | null) {
  const pool = getPool();
  await pool.query(
    `insert into device_tokens (id, customer_id, kind, token, p256dh, auth, user_agent)
     values ($1, $2, 'web', $3, $4, $5, $6)
     on conflict (token) do update
       set customer_id = excluded.customer_id, p256dh = excluded.p256dh, auth = excluded.auth,
           user_agent = excluded.user_agent`,
    [randomUUID(), customerId, sub.endpoint, sub.p256dh, sub.auth, userAgent?.slice(0, 200) ?? null],
  );
  await pool.query(
    `delete from device_tokens
     where customer_id = $1 and id not in (
       select id from device_tokens where customer_id = $1 order by created_at desc limit $2)`,
    [customerId, MAX_DEVICES],
  );
}

export async function removeSubscription(customerId: string, endpoint: string) {
  await getPool().query("delete from device_tokens where customer_id = $1 and token = $2", [customerId, endpoint]);
}

export async function listWebSubscriptions(customerId: string): Promise<WebSubscription[]> {
  const { rows } = await getPool().query<{ token: string; p256dh: string; auth: string }>(
    "select token, p256dh, auth from device_tokens where customer_id = $1 and kind = 'web' and p256dh is not null and auth is not null",
    [customerId],
  );
  return rows.map((r) => ({ endpoint: r.token, p256dh: r.p256dh, auth: r.auth }));
}

export async function deleteByEndpoint(endpoint: string) {
  await getPool().query("delete from device_tokens where token = $1", [endpoint]);
}

export async function touchEndpoint(endpoint: string) {
  await getPool().query("update device_tokens set last_used_at = now() where token = $1", [endpoint]);
}
