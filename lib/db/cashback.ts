import "server-only";
import { getPool } from "@/lib/db";
import type { AdminCashbackEntry, CashbackEntry, CashbackRule, CashbackService, CashbackSettings } from "@/lib/admin/cashback";

const MASTER_KEY = "cashback_enabled";
type RuleRow = { service: CashbackService; enabled: boolean; percent: string; min_spend: string; monthly_cap: string | null };

const toRule = (r: RuleRow): CashbackRule => ({
  service: r.service,
  enabled: r.enabled,
  percent: Number(r.percent),
  minSpend: Number(r.min_spend),
  monthlyCap: r.monthly_cap === null ? null : Number(r.monthly_cap),
});

export async function getCashbackBalanceKobo(customerId: string): Promise<bigint> {
  await getPool().query(
    "insert into cashback_wallets (customer_id) values ($1) on conflict (customer_id) do nothing",
    [customerId],
  );
  const { rows } = await getPool().query<{ balance_kobo: string }>(
    "select balance_kobo::text from cashback_wallets where customer_id = $1",
    [customerId],
  );
  return BigInt(rows[0]?.balance_kobo ?? "0");
}

export async function changeCashbackBalance(input: {
  customerId: string;
  amountKobo: number;
  reference: string;
  direction: "credit" | "debit";
  source: "earn" | "spend" | "restore" | "referral" | "adjust";
  service?: string | null;
  note?: string | null;
  createdBy?: string | null;
}): Promise<boolean> {
  if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo <= 0) {
    throw new Error("Cashback amounts must be positive whole kobo.");
  }
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      "insert into cashback_wallets (customer_id) values ($1) on conflict (customer_id) do nothing",
      [input.customerId],
    );
    const wallet = await client.query<{ balance_kobo: string }>(
      "select balance_kobo::text from cashback_wallets where customer_id = $1 for update",
      [input.customerId],
    );
    const prior = await client.query("select 1 from cashback_ledger where reference = $1", [input.reference]);
    if (prior.rowCount) {
      await client.query("commit");
      return true;
    }
    if (input.direction === "debit" && BigInt(wallet.rows[0].balance_kobo) < BigInt(input.amountKobo)) {
      await client.query("rollback");
      return false;
    }
    await client.query(
      `insert into cashback_ledger (reference, customer_id, direction, amount_kobo, source, service, note, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [input.reference, input.customerId, input.direction, input.amountKobo, input.source,
       input.service ?? null, input.note ?? null, input.createdBy ?? null],
    );
    const delta = input.direction === "credit" ? input.amountKobo : -input.amountKobo;
    await client.query(
      "update cashback_wallets set balance_kobo = balance_kobo + $2, updated_at = now() where customer_id = $1",
      [input.customerId, delta],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function awardCashbackFor(transactionId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const tx = await client.query<{ customer_id: string; service: string; amount: string; cashback_used: string }>(
      `select customer_id, service, amount::text, cashback_used::text
       from transactions
       where id = $1 and status = 'success' and direction = 'debit' and cashback_earned = 0
       for update`,
      [transactionId],
    );
    const row = tx.rows[0];
    const master = await client.query<{ value: string }>("select value from app_settings where key = $1", [MASTER_KEY]);
    if (!row || master.rows[0]?.value !== "true") {
      await client.query("rollback");
      return 0;
    }
    const ruleResult = await client.query<RuleRow>(
      "select service, enabled, percent::text, min_spend::text, monthly_cap::text from cashback_rules where service = $1 and enabled",
      [row.service],
    );
    const rule = ruleResult.rows[0];
    const paidFromWallet = Number(row.amount) - Number(row.cashback_used);
    if (!rule || Number(rule.percent) <= 0 || paidFromWallet <= 0 || paidFromWallet < Number(rule.min_spend)) {
      await client.query("rollback");
      return 0;
    }
    await client.query("insert into cashback_wallets (customer_id) values ($1) on conflict (customer_id) do nothing", [row.customer_id]);
    await client.query("select 1 from cashback_wallets where customer_id = $1 for update", [row.customer_id]);

    let earnedKobo = Math.floor((Math.round(paidFromWallet * 100) * Number(rule.percent)) / 100);
    if (rule.monthly_cap !== null) {
      const used = await client.query<{ total: string }>(
        `select coalesce(sum(amount_kobo), 0)::text as total from cashback_ledger
         where customer_id = $1 and source = 'earn' and service = $2
           and created_at >= date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'`,
        [row.customer_id, row.service],
      );
      earnedKobo = Math.min(earnedKobo, Math.round(Number(rule.monthly_cap) * 100) - Number(used.rows[0].total));
    }
    if (earnedKobo <= 0) {
      await client.query("rollback");
      return 0;
    }
    const ledger = await client.query(
      `insert into cashback_ledger (reference, customer_id, direction, amount_kobo, source, service)
       values ($1, $2, 'credit', $3, 'earn', $4) on conflict (reference) do nothing returning reference`,
      [`${transactionId}:earn`, row.customer_id, earnedKobo, row.service],
    );
    if (!ledger.rowCount) {
      await client.query("rollback");
      return 0;
    }
    await client.query(
      "update cashback_wallets set balance_kobo = balance_kobo + $2, updated_at = now() where customer_id = $1",
      [row.customer_id, earnedKobo],
    );
    await client.query("update transactions set cashback_earned = $2 where id = $1", [transactionId, earnedKobo / 100]);
    await client.query("commit");
    return earnedKobo / 100;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCashbackSettings(): Promise<CashbackSettings> {
  const pool = getPool();
  const [master, rules] = await Promise.all([
    pool.query<{ value: string }>("select value from app_settings where key = $1", [MASTER_KEY]),
    pool.query<RuleRow>(
      `select service, enabled, percent::text, min_spend::text, monthly_cap::text from cashback_rules
       order by case service when 'data' then 1 when 'cable' then 2 when 'airtime' then 3 else 4 end`,
    ),
  ]);
  return { enabled: master.rows[0]?.value === "true", rules: rules.rows.map(toRule) };
}

export async function saveCashbackSettings(settings: CashbackSettings): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into app_settings (key, value) values ($1, $2)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [MASTER_KEY, String(settings.enabled)],
    );
    for (const rule of settings.rules) {
      await client.query(
        `insert into cashback_rules (service, enabled, percent, min_spend, monthly_cap)
         values ($1, $2, $3, $4, $5)
         on conflict (service) do update
         set enabled = excluded.enabled,
             percent = excluded.percent,
             min_spend = excluded.min_spend,
             monthly_cap = excluded.monthly_cap`,
        [rule.service, rule.enabled, rule.percent, rule.minSpend, rule.monthlyCap],
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

export async function getPublicCashbackRules(): Promise<CashbackRule[]> {
  const settings = await getCashbackSettings();
  return settings.enabled ? settings.rules.filter((r) => r.enabled && r.percent > 0) : [];
}

export async function listCashbackHistory(customerId: string, limit = 20): Promise<CashbackEntry[]> {
  const { rows } = await getPool().query<{
    reference: string;
    direction: "credit" | "debit";
    amount_kobo: string;
    source: CashbackEntry["source"];
    created_at: Date;
  }>(
    `select reference, direction, amount_kobo::text, source, created_at from cashback_ledger
     where customer_id = $1 order by created_at desc limit $2`,
    [customerId, limit],
  );
  return rows.map((r) => ({
    id: r.reference,
    direction: r.direction,
    amount: Number(r.amount_kobo) / 100,
    source: r.source,
    at: r.created_at.toISOString(),
  }));
}

export async function listAdminCashbackLedger(limit = 50): Promise<AdminCashbackEntry[]> {
  const { rows } = await getPool().query<{
    reference: string;
    direction: "credit" | "debit";
    amount_kobo: string;
    source: AdminCashbackEntry["source"];
    note: string | null;
    created_at: Date;
    name: string | null;
    username: string | null;
  }>(
    `select l.reference, l.direction, l.amount_kobo::text, l.source, l.note, l.created_at, c.name, c.username
     from cashback_ledger l
     join customers c on c.id = l.customer_id
     order by l.created_at desc
     limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.reference,
    customer: r.username ? `@${r.username}` : (r.name ?? "unknown"),
    direction: r.direction,
    amount: Number(r.amount_kobo) / 100,
    source: r.source,
    note: r.note,
    at: r.created_at.toISOString(),
  }));
}

export async function getCashbackLiability(): Promise<number> {
  const { rows } = await getPool().query<{ total: string }>(
    "select coalesce(sum(balance_kobo), 0)::text as total from cashback_wallets",
  );
  return Number(rows[0]?.total ?? 0) / 100;
}
