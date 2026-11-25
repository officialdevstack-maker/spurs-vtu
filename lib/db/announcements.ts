import "server-only";
import { getPool } from "@/lib/db";
import {
  isChannel,
  type Audience,
  type BroadcastRecord,
  type BroadcastResults,
  type Channel,
  type NotificationItem,
  type Recipient,
  type WelcomeTemplate,
} from "@/lib/admin/announcements";

const changed = (r: { rowCount: number | null }) => (r.rowCount ?? 0) > 0;

export async function getWelcomeTemplates(): Promise<WelcomeTemplate[]> {
  const { rows } = await getPool().query<{ channel: string; enabled: boolean; subject: string; body: string }>(
    "select channel, enabled, subject, body from welcome_templates",
  );
  const order: Channel[] = ["system", "email", "sms", "push"];
  return rows
    .filter((row): row is typeof row & { channel: Channel } => isChannel(row.channel))
    .sort((a, b) => order.indexOf(a.channel) - order.indexOf(b.channel));
}

export async function saveWelcomeTemplates(templates: WelcomeTemplate[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    for (const t of templates) {
      await client.query(
        `insert into welcome_templates (channel, enabled, subject, body) values ($1, $2, $3, $4)
         on conflict (channel) do update set enabled = excluded.enabled, subject = excluded.subject,
         body = excluded.body, updated_at = now()`,
        [t.channel, t.enabled, t.subject, t.body],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function claimWelcome(customerId: string): Promise<Recipient | null> {
  const { rows } = await getPool().query<Recipient>(
    `update customers set welcome_sent_at = now()
     where id = $1 and welcome_sent_at is null
     returning id, name, username, email, phone`,
    [customerId],
  );
  return rows[0] ?? null;
}

export async function insertNotification(n: {
  id: string;
  customerId: string;
  title: string;
  body: string;
}): Promise<void> {
  await getPool().query(
    `insert into vtu_notifications (id, customer_id, title, body) values ($1, $2, $3, $4)
     on conflict (id) do nothing`,
    [n.id, n.customerId, n.title, n.body],
  );
}

export async function insertSystemNotifications(
  broadcastId: string,
  items: { customerId: string; title: string; body: string }[],
): Promise<number> {
  if (items.length === 0) return 0;
  const result = await getPool().query(
    `insert into vtu_notifications (id, customer_id, title, body, broadcast_id)
     select $1::text || ':' || t.customer_id, t.customer_id, t.title, t.body, $1::text
     from unnest($2::text[], $3::text[], $4::text[]) as t(customer_id, title, body)
     on conflict (id) do nothing`,
    [broadcastId, items.map((i) => i.customerId), items.map((i) => i.title), items.map((i) => i.body)],
  );
  return result.rowCount ?? 0;
}

export async function getUnreadCount(customerId: string): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>(
    "select count(*)::text as n from vtu_notifications where customer_id = $1 and read_at is null",
    [customerId],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function listNotifications(customerId: string, limit = 50): Promise<NotificationItem[]> {
  const { rows } = await getPool().query<{
    id: string;
    title: string;
    body: string;
    read_at: Date | null;
    created_at: Date;
  }>(
    `select id, title, body, read_at, created_at from vtu_notifications
     where customer_id = $1 order by created_at desc, id limit $2`,
    [customerId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    read: row.read_at !== null,
    at: row.created_at.toISOString(),
  }));
}

export async function markAllNotificationsRead(customerId: string): Promise<void> {
  await getPool().query("update vtu_notifications set read_at = now() where customer_id = $1 and read_at is null", [customerId]);
}

const AUDIENCE_WHERE = `c.status = 'active'
  and ($1 = 'all'
       or ($1 = 'package' and c.package_id = $2)
       or ($1 = 'staff' and exists (select 1 from staff_members s where s.customer_id = c.id)))`;

export async function countAudience(audience: Audience, packageId: string | null): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>(
    `select count(*)::text as n from customers c where ${AUDIENCE_WHERE}`,
    [audience, packageId],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function nextAudienceChunk(
  audience: Audience,
  packageId: string | null,
  cursor: string | null,
  limit: number,
): Promise<Recipient[]> {
  const { rows } = await getPool().query<Recipient>(
    `select c.id, c.name, c.username, c.email, c.phone from customers c
     where ${AUDIENCE_WHERE} and ($3::text is null or c.id > $3)
     order by c.id limit $4`,
    [audience, packageId, cursor, limit],
  );
  return rows;
}

export async function createBroadcast(b: {
  id: string;
  title: string;
  body: string;
  channels: Channel[];
  audience: Audience;
  packageId: string | null;
  total: number;
  createdBy: string;
}): Promise<void> {
  await getPool().query(
    `insert into broadcasts (id, title, body, channels, audience, package_id, total, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [b.id, b.title, b.body, b.channels, b.audience, b.packageId, b.total, b.createdBy],
  );
}

export type BroadcastJob = {
  id: string;
  title: string;
  body: string;
  channels: Channel[];
  audience: Audience;
  packageId: string | null;
  processed: number;
  results: BroadcastResults;
  cursor: string | null;
};

export async function claimBroadcast(id: string): Promise<BroadcastJob | null> {
  const { rows } = await getPool().query<{
    id: string;
    title: string;
    body: string;
    channels: Channel[];
    audience: Audience;
    package_id: string | null;
    processed: number;
    results: BroadcastResults;
    cursor: string | null;
  }>(
    `update broadcasts set locked_until = now() + interval '3 minutes'
     where id = $1 and status = 'sending' and (locked_until is null or locked_until < now())
     returning id, title, body, channels, audience, package_id, processed, results, cursor`,
    [id],
  );
  const row = rows[0];
  return row ? {
    id: row.id,
    title: row.title,
    body: row.body,
    channels: row.channels,
    audience: row.audience,
    packageId: row.package_id,
    processed: row.processed,
    results: row.results ?? {},
    cursor: row.cursor,
  } : null;
}

export async function saveProgress(
  id: string,
  progress: { cursor: string | null; processed: number; results: BroadcastResults },
  release = false,
): Promise<void> {
  await getPool().query(
    `update broadcasts
     set cursor = $2, processed = $3, results = $4::jsonb,
         locked_until = case when $5 then null else now() + interval '3 minutes' end
     where id = $1`,
    [id, progress.cursor, progress.processed, JSON.stringify(progress.results), release],
  );
}

export async function finishBroadcast(id: string, status: "sent" | "failed"): Promise<boolean> {
  return changed(await getPool().query(
    "update broadcasts set status = $2, locked_until = null, finished_at = now() where id = $1",
    [id, status],
  ));
}

export async function listSendingBroadcastIds(limit = 3): Promise<string[]> {
  const { rows } = await getPool().query<{ id: string }>(
    "select id from broadcasts where status = 'sending' order by created_at limit $1",
    [limit],
  );
  return rows.map((row) => row.id);
}

export async function listBroadcasts(limit = 15): Promise<BroadcastRecord[]> {
  const { rows } = await getPool().query<{
    id: string;
    title: string;
    body: string;
    channels: Channel[];
    audience: Audience;
    package_name: string | null;
    status: BroadcastRecord["status"];
    total: number;
    processed: number;
    results: BroadcastResults;
    created_at: Date;
    finished_at: Date | null;
  }>(
    `select b.id, b.title, b.body, b.channels, b.audience, p.name as package_name, b.status,
            b.total, b.processed, b.results, b.created_at, b.finished_at
     from broadcasts b left join packages p on p.id = b.package_id
     order by b.created_at desc limit $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    channels: row.channels,
    audience: row.audience,
    packageName: row.package_name,
    status: row.status,
    total: row.total,
    processed: row.processed,
    results: row.results ?? {},
    createdAt: row.created_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
  }));
}
