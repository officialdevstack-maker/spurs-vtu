import "server-only";
import { getPool } from "@/lib/db";
import type { Promo, PromoFields, PromoKind, PromoService } from "@/lib/admin/promotions";

type Row = {
  id: string;
  code: string;
  description: string;
  kind: PromoKind;
  value: string;
  max_discount: string | null;
  min_spend: string;
  services: PromoService[];
  total_limit: number | null;
  per_customer_limit: number;
  starts_at: Date | null;
  expires_at: Date | null;
  active: boolean;
  used?: string;
};

const toPromo = (r: Row): Promo => ({
  id: r.id,
  code: r.code,
  description: r.description,
  kind: r.kind,
  value: Number(r.value),
  maxDiscount: r.max_discount === null ? null : Number(r.max_discount),
  minSpend: Number(r.min_spend),
  services: r.services,
  totalLimit: r.total_limit,
  perCustomerLimit: r.per_customer_limit,
  startsAt: r.starts_at?.toISOString() ?? null,
  expiresAt: r.expires_at?.toISOString() ?? null,
  active: r.active,
  used: Number(r.used ?? 0),
});

const COLS = `p.id, p.code, p.description, p.kind, p.value, p.max_discount, p.min_spend, p.services,
  p.total_limit, p.per_customer_limit, p.starts_at, p.expires_at, p.active`;
const USED = `(select count(*) from promo_redemptions r join transactions t on t.id = r.transaction_id
               where r.promo_id = p.id and t.status <> 'failed')`;
const changed = (r: { rowCount: number | null }) => (r.rowCount ?? 0) > 0;

export async function listPromos(): Promise<Promo[]> {
  const { rows } = await getPool().query<Row>(
    `select ${COLS}, ${USED}::text as used from promo_codes p order by p.created_at desc`,
  );
  return rows.map(toPromo);
}

export async function getPromoByCode(code: string): Promise<Promo | null> {
  const { rows } = await getPool().query<Row>(
    `select ${COLS}, ${USED}::text as used from promo_codes p where upper(p.code) = $1`,
    [code],
  );
  return rows[0] ? toPromo(rows[0]) : null;
}

export async function countCustomerUses(promoId: string, customerId: string): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>(
    `select count(*)::text as n from promo_redemptions r join transactions t on t.id = r.transaction_id
     where r.promo_id = $1 and r.customer_id = $2 and t.status <> 'failed'`,
    [promoId, customerId],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function reserveRedemption(input: {
  transactionId: string;
  promoId: string;
  customerId: string;
  discount: number;
}): Promise<"ok" | "unavailable"> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ live: boolean; total_limit: number | null; per_customer_limit: number }>(
      `select (active and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at > now())) as live,
              total_limit, per_customer_limit
       from promo_codes where id = $1 for update`,
      [input.promoId],
    );
    const promo = rows[0];
    if (!promo?.live) {
      await client.query("rollback");
      return "unavailable";
    }
    const counts = await client.query<{ total: string; mine: string }>(
      `select count(*)::text as total, (count(*) filter (where r.customer_id = $2))::text as mine
       from promo_redemptions r join transactions t on t.id = r.transaction_id
       where r.promo_id = $1 and t.status <> 'failed'`,
      [input.promoId, input.customerId],
    );
    const total = Number(counts.rows[0].total);
    const mine = Number(counts.rows[0].mine);
    if ((promo.total_limit !== null && total >= promo.total_limit) || mine >= promo.per_customer_limit) {
      await client.query("rollback");
      return "unavailable";
    }
    await client.query(
      `insert into promo_redemptions (transaction_id, promo_id, customer_id, discount) values ($1, $2, $3, $4)`,
      [input.transactionId, input.promoId, input.customerId, input.discount],
    );
    await client.query("commit");
    return "ok";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

const VALUES = (f: PromoFields) => [
  f.code, f.description, f.kind, f.value, f.maxDiscount, f.minSpend, f.services,
  f.totalLimit, f.perCustomerLimit, f.startsAt, f.expiresAt, f.active,
];

export async function createPromo(id: string, f: PromoFields): Promise<boolean> {
  return changed(await getPool().query(
    `insert into promo_codes (id, code, description, kind, value, max_discount, min_spend, services,
                              total_limit, per_customer_limit, starts_at, expires_at, active)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [id, ...VALUES(f)],
  ));
}

export async function updatePromo(id: string, f: PromoFields): Promise<boolean> {
  return changed(await getPool().query(
    `update promo_codes
     set code = $2, description = $3, kind = $4, value = $5, max_discount = $6, min_spend = $7, services = $8,
         total_limit = $9, per_customer_limit = $10, starts_at = $11, expires_at = $12, active = $13
     where id = $1`,
    [id, ...VALUES(f)],
  ));
}

export async function setPromoActive(id: string, active: boolean): Promise<boolean> {
  return changed(await getPool().query("update promo_codes set active = $2 where id = $1", [id, active]));
}

export async function deletePromo(id: string): Promise<boolean> {
  return changed(await getPool().query("delete from promo_codes where id = $1", [id]));
}
