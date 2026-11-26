import "server-only";
import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import type { AdminReferral, ReferralOverview, ReferralSettings } from "@/lib/admin/referrals";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from(randomBytes(8), (byte) => ALPHABET[byte % ALPHABET.length]).join("");

type SettingsRow = {
  enabled: boolean;
  referrer_reward: string;
  referee_reward: string;
  min_purchase: string;
  monthly_limit: number;
};

const toSettings = (row: SettingsRow): ReferralSettings => ({
  enabled: row.enabled,
  referrerReward: Number(row.referrer_reward),
  refereeReward: Number(row.referee_reward),
  minPurchase: Number(row.min_purchase),
  monthlyLimit: row.monthly_limit,
});

export async function ensureReferralCode(customerId: string): Promise<string> {
  const pool = getPool();
  const read = async () =>
    (await pool.query<{ referral_code: string | null }>("select referral_code from customers where id = $1", [customerId]))
      .rows[0]?.referral_code ?? null;

  const existing = await read();
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await pool.query<{ referral_code: string }>(
        "update customers set referral_code = $2 where id = $1 and referral_code is null returning referral_code",
        [customerId, newCode()],
      );
      if (rows[0]) return rows[0].referral_code;
      const raced = await read();
      if (raced) return raced;
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error;
    }
  }
  throw new Error("Could not create a referral code.");
}

export async function getReferralSettings(): Promise<ReferralSettings> {
  const { rows } = await getPool().query<SettingsRow>(
    `select enabled, referrer_reward::text, referee_reward::text, min_purchase::text, monthly_limit
     from referral_settings where id = 'main'`,
  );
  return rows[0]
    ? toSettings(rows[0])
    : { enabled: false, referrerReward: 0, refereeReward: 0, minPurchase: 0, monthlyLimit: 0 };
}

export async function saveReferralSettings(settings: ReferralSettings): Promise<void> {
  await getPool().query(
    `insert into referral_settings (id, enabled, referrer_reward, referee_reward, min_purchase, monthly_limit)
     values ('main', $1, $2, $3, $4, $5)
     on conflict (id) do update
     set enabled = excluded.enabled,
         referrer_reward = excluded.referrer_reward,
         referee_reward = excluded.referee_reward,
         min_purchase = excluded.min_purchase,
         monthly_limit = excluded.monthly_limit`,
    [settings.enabled, settings.referrerReward, settings.refereeReward, settings.minPurchase, settings.monthlyLimit],
  );
}

export async function recordReferral(refereeId: string, code: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `insert into referrals (referee_id, referrer_id)
     select e.id, r.id
     from customers r, customers e
     where r.referral_code = $2 and e.id = $1
       and r.id <> e.id
       and r.status = 'active'
       and e.created_at > now() - interval '7 days'
       and not exists (select 1 from transactions t where t.customer_id = e.id and t.direction = 'debit')
       and (r.phone is null or e.phone is null or r.phone <> e.phone)
     on conflict (referee_id) do nothing`,
    [refereeId, code],
  );
  return (rowCount ?? 0) > 0;
}

async function credit(client: PoolClient, customerId: string, naira: number, reference: string) {
  const amountKobo = Math.round(naira * 100);
  if (amountKobo <= 0) return;
  await client.query("insert into cashback_wallets (customer_id) values ($1) on conflict (customer_id) do nothing", [customerId]);
  await client.query("select 1 from cashback_wallets where customer_id = $1 for update", [customerId]);
  const entry = await client.query(
    `insert into cashback_ledger (reference, customer_id, direction, amount_kobo, source)
     values ($1, $2, 'credit', $3, 'referral') on conflict (reference) do nothing returning reference`,
    [reference, customerId, amountKobo],
  );
  if (entry.rowCount) {
    await client.query(
      "update cashback_wallets set balance_kobo = balance_kobo + $2, updated_at = now() where customer_id = $1",
      [customerId, amountKobo],
    );
  }
}

export type ReferralPayout = { referrerId: string; refereeId: string; referrerReward: number; refereeReward: number };

export async function awardReferralFor(transactionId: string): Promise<ReferralPayout | null> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const tx = await client.query<{ customer_id: string; paid: string }>(
      `select customer_id, (amount - cashback_used)::text as paid
       from transactions where id = $1 and status = 'success' and direction = 'debit'`,
      [transactionId],
    );
    const purchase = tx.rows[0];
    const settings = (
      await client.query<SettingsRow>(
        `select enabled, referrer_reward::text, referee_reward::text, min_purchase::text, monthly_limit
         from referral_settings where id = 'main'`,
      )
    ).rows[0];
    if (!purchase || !settings?.enabled || Number(purchase.paid) < Number(settings.min_purchase)) {
      await client.query("rollback");
      return null;
    }

    const link = await client.query<{ referrer_id: string }>(
      `select f.referrer_id from referrals f
       join customers c on c.id = f.referrer_id and c.status = 'active'
       where f.referee_id = $1 and f.status = 'pending'
       for update of f`,
      [purchase.customer_id],
    );
    if (!link.rows[0]) {
      await client.query("rollback");
      return null;
    }
    const referrerId = link.rows[0].referrer_id;

    const used = await client.query<{ n: string }>(
      `select count(*)::text as n from referrals
       where referrer_id = $1 and status = 'rewarded'
         and rewarded_at >= date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'`,
      [referrerId],
    );
    const referrerReward = Number(used.rows[0].n) < settings.monthly_limit ? Number(settings.referrer_reward) : 0;
    const refereeReward = Number(settings.referee_reward);

    await credit(client, referrerId, referrerReward, `referral:${purchase.customer_id}:referrer`);
    await credit(client, purchase.customer_id, refereeReward, `referral:${purchase.customer_id}:referee`);
    await client.query("update referrals set status = 'rewarded', rewarded_at = now() where referee_id = $1", [purchase.customer_id]);
    await client.query("commit");
    return { referrerId, refereeId: purchase.customer_id, referrerReward, refereeReward };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getReferralOverview(customerId: string): Promise<ReferralOverview> {
  const pool = getPool();
  const [mine, earned, own] = await Promise.all([
    pool.query<{ invited: string; rewarded: string }>(
      `select count(*)::text as invited, (count(*) filter (where status = 'rewarded'))::text as rewarded
       from referrals where referrer_id = $1`,
      [customerId],
    ),
    pool.query<{ total: string }>(
      `select coalesce(sum(amount_kobo), 0)::text as total from cashback_ledger
       where customer_id = $1 and source = 'referral' and reference like 'referral:%:referrer'`,
      [customerId],
    ),
    pool.query<{ status: string }>("select status from referrals where referee_id = $1", [customerId]),
  ]);
  return {
    invited: Number(mine.rows[0]?.invited ?? 0),
    rewarded: Number(mine.rows[0]?.rewarded ?? 0),
    earned: Number(earned.rows[0]?.total ?? 0) / 100,
    waitingOnFirstPurchase: own.rows[0]?.status === "pending",
    hasReferrer: own.rows.length > 0,
  };
}

export async function listReferrals(limit = 50): Promise<AdminReferral[]> {
  const { rows } = await getPool().query<{
    referee_id: string;
    referee: string | null;
    referrer: string | null;
    status: "pending" | "rewarded";
    created_at: Date;
    rewarded_at: Date | null;
  }>(
    `select f.referee_id,
            coalesce('@' || e.username, e.name) as referee,
            coalesce('@' || r.username, r.name) as referrer,
            f.status, f.created_at, f.rewarded_at
     from referrals f
     join customers e on e.id = f.referee_id
     join customers r on r.id = f.referrer_id
     order by f.created_at desc
     limit $1`,
    [limit],
  );
  return rows.map((row) => ({
    refereeId: row.referee_id,
    referee: row.referee ?? "unknown",
    referrer: row.referrer ?? "unknown",
    status: row.status,
    at: row.created_at.toISOString(),
    rewardedAt: row.rewarded_at?.toISOString() ?? null,
  }));
}

export async function revokePendingReferral(refereeId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    "delete from referrals where referee_id = $1 and status = 'pending'",
    [refereeId],
  );
  return (rowCount ?? 0) > 0;
}
