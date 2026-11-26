import "server-only";
import { getPool } from "@/lib/db";
import {
  type Audience,
  type BroadcastRecord,
  type BroadcastResults,
  type Channel,
  type NotificationItem,
  type Recipient,
  type WelcomePopup,
} from "@/lib/admin/announcements";

const changed = (r: { rowCount: number | null }) => (r.rowCount ?? 0) > 0;

type PopupRow = {
  enabled: boolean;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string;
  version: number;
};

const toPopup = (row: PopupRow): WelcomePopup => ({
  enabled: row.enabled,
  title: row.title,
  body: row.body,
  ctaLabel: row.cta_label,
  ctaHref: row.cta_href,
  version: row.version,
});

export async function getWelcomePopup(): Promise<WelcomePopup> {
  const { rows } = await getPool().query<PopupRow>(
    "select enabled, title, body, cta_label, cta_href, version from welcome_popup where id = 'welcome'",
  );
  return rows[0] ? toPopup(rows[0]) : { enabled: false, title: "", body: "", ctaLabel: "", ctaHref: "", version: 1 };
}

export async function saveWelcomePopup(popup: Omit<WelcomePopup, "version">, showAgain: boolean): Promise<void> {
  await getPool().query(
    `insert into welcome_popup (id, enabled, title, body, cta_label, cta_href)
     values ('welcome', $1, $2, $3, $4, $5)
     on conflict (id) do update
       set enabled = excluded.enabled, title = excluded.title, body = excluded.body,
           cta_label = excluded.cta_label, cta_href = excluded.cta_href,
           version = welcome_popup.version + case when $6::boolean then 1 else 0 end,
           updated_at = now()`,
    [popup.enabled, popup.title, popup.body, popup.ctaLabel, popup.ctaHref, showAgain],
  );
}

export async function getUnseenWelcome(customerId: string): Promise<WelcomePopup | null> {
  const { rows } = await getPool().query<PopupRow>(
    `select w.enabled, w.title, w.body, w.cta_label, w.cta_href, w.version
     from welcome_popup w
     join customers c on c.id = $1
     where w.enabled and c.welcome_seen_version < w.version`,
    [customerId],
  );
  return rows[0] ? toPopup(rows[0]) : null;
}

export async function markWelcomeSeen(customerId: string, version: number): Promise<void> {
  await getPool().query(
    "update customers set welcome_seen_version = greatest(welcome_seen_version, $2) where id = $1",
    [customerId, version],
  );
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
