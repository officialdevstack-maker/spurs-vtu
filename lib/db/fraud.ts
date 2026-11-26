import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import type { FlagItem, FraudAction, FraudRule, FraudRuleId } from "@/lib/admin/fraud";

export async function getRules(): Promise<FraudRule[]> {
  const { rows } = await getPool().query<{ rule: FraudRuleId; enabled: boolean; action: FraudAction; params: Record<string, number> }>(
    `select rule, enabled, action, params from fraud_rules
     order by case rule when 'velocity' then 1 when 'repeated_failures' then 2 when 'shared_phone' then 3 else 4 end`,
  );
  return rows;
}

export async function saveRule(rule: FraudRuleId, enabled: boolean, action: FraudAction, params: Record<string, number>) {
  const { rowCount } = await getPool().query(
    "update fraud_rules set enabled = $2, action = $3, params = $4::jsonb, updated_at = now() where rule = $1",
    [rule, enabled, action, JSON.stringify(params)],
  );
  return (rowCount ?? 0) > 0;
}

export async function isExempt(customerId: string): Promise<boolean> {
  const { rows } = await getPool().query<{ fraud_exempt: boolean }>(
    "select fraud_exempt from customers where id = $1",
    [customerId],
  );
  return rows[0]?.fraud_exempt ?? false;
}

export async function hasOpenHold(customerId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    "select 1 from fraud_flags where customer_id = $1 and status = 'open' and action = 'hold' limit 1",
    [customerId],
  );
  return (rowCount ?? 0) > 0;
}

export async function countRecentDebits(customerId: string, minutes: number): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>(
    `select count(*)::text as n from transactions
     where customer_id = $1 and direction = 'debit' and created_at > now() - make_interval(mins => $2::int)`,
    [customerId, minutes],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function countRecentFailures(customerId: string, minutes: number): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>(
    `select count(*)::text as n from transactions
     where customer_id = $1 and direction = 'debit' and status = 'failed'
       and created_at > now() - make_interval(mins => $2::int)`,
    [customerId, minutes],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function countSharedPhone(customerId: string): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>(
    `select count(*)::text as n from customers o
     join customers c on c.phone = o.phone
     where c.id = $1 and c.phone is not null and c.phone <> ''`,
    [customerId],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function getSpendProfile(customerId: string): Promise<{ average: number; count: number }> {
  const { rows } = await getPool().query<{ avg: string | null; n: string }>(
    `select avg(amount)::text as avg, count(*)::text as n from transactions
     where customer_id = $1 and direction = 'debit' and status = 'success' and service <> 'wallet'`,
    [customerId],
  );
  return { average: Number(rows[0]?.avg ?? 0), count: Number(rows[0]?.n ?? 0) };
}

export async function openFlag(f: {
  customerId: string;
  rule: FraudRuleId;
  action: FraudAction;
  reference: string;
  detail: Record<string, unknown>;
}): Promise<string | null> {
  const id = randomUUID();
  const { rowCount } = await getPool().query(
    `insert into fraud_flags (id, customer_id, rule, action, reference, detail)
     values ($1, $2, $3, $4, $5, $6::jsonb)
     on conflict (customer_id, rule) where status = 'open' do nothing`,
    [id, f.customerId, f.rule, f.action, f.reference, JSON.stringify(f.detail)],
  );
  return (rowCount ?? 0) > 0 ? id : null;
}

export async function listOpenFlags(limit = 100): Promise<FlagItem[]> {
  const { rows } = await getPool().query<{
    id: string; customer_id: string; username: string | null; name: string | null;
    rule: FraudRuleId; action: FraudAction; detail: Record<string, unknown>; created_at: Date;
  }>(
    `select f.id, f.customer_id, c.username, c.name, f.rule, f.action, f.detail, f.created_at
     from fraud_flags f join customers c on c.id = f.customer_id
     where f.status = 'open'
     order by (f.action = 'hold') desc, f.created_at
     limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    customer: r.username ? `@${r.username}` : (r.name ?? "unknown"),
    rule: r.rule,
    action: r.action,
    detail: r.detail,
    at: r.created_at.toISOString(),
  }));
}

export async function reviewFlag(id: string, resolution: "dismissed" | "confirmed", note: string, adminId: string) {
  const { rows } = await getPool().query<{ customer_id: string }>(
    `update fraud_flags
     set status = 'reviewed', resolution = $2, note = $3, reviewed_by = $4, reviewed_at = now()
     where id = $1 and status = 'open'
     returning customer_id`,
    [id, resolution, note, adminId],
  );
  return rows[0]?.customer_id ?? null;
}

export async function countOpenFlags(): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>("select count(*)::text as n from fraud_flags where status = 'open'");
  return Number(rows[0]?.n ?? 0);
}
