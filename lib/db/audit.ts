import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import type { AuditRecord } from "@/lib/admin/audit";

export type AuditActor = { sub: string; name?: string | null; username?: string | null; email?: string | null };
export type AuditEntry = { action: string; target?: string | null; summary: string; meta?: Record<string, unknown> };

const SECRET_KEY = /secret|password|token|hash|bvn|api[_-]?key|^pin$/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[omitted]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrub(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? "[redacted]" : scrub(item, depth + 1)]),
    );
  }
  return typeof value === "string" ? value.slice(0, 500) : value;
}

export async function recordAudit(actor: AuditActor, entry: AuditEntry): Promise<void> {
  try {
    const label = actor.username ? `@${actor.username}` : actor.name || actor.email || actor.sub;
    let meta = JSON.stringify(scrub(entry.meta ?? {}));
    if (meta.length > 8000) meta = JSON.stringify({ truncated: true });
    await getPool().query(
      `insert into admin_audit_log (id, actor_id, actor_label, action, target, summary, meta)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [randomUUID(), actor.sub, label, entry.action, entry.target ?? null, entry.summary.slice(0, 500), meta],
    );
  } catch (error) {
    console.error("[audit] Could not record", entry.action, entry.target, error);
  }
}

export async function listAudit(filters: { query: string; page: number; pageSize: number }) {
  const pool = getPool();
  const escaped = filters.query.trim().replace(/[!%_]/g, "!$&");
  const search = escaped ? `%${escaped}%` : null;
  const from = `from admin_audit_log
    where ($1::text is null or actor_label ilike $1 escape '!' or action ilike $1 escape '!'
           or target ilike $1 escape '!' or summary ilike $1 escape '!')`;

  const count = await pool.query<{ n: string }>(`select count(*)::text as n ${from}`, [search]);
  const total = Number(count.rows[0]?.n ?? 0);
  const pageSize = Math.max(1, Math.min(filters.pageSize, 100));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page), pageCount);

  const { rows } = await pool.query<{
    id: string;
    actor_label: string;
    action: string;
    target: string | null;
    summary: string;
    meta: Record<string, unknown>;
    created_at: Date;
  }>(
    `select id, actor_label, action, target, summary, meta, created_at ${from}
     order by created_at desc, id limit $2 offset $3`,
    [search, pageSize, (page - 1) * pageSize],
  );

  const items: AuditRecord[] = rows.map((row) => ({
    id: row.id,
    actor: row.actor_label,
    action: row.action,
    target: row.target,
    summary: row.summary,
    meta: row.meta,
    at: row.created_at.toISOString(),
  }));
  return { items, total, page };
}
