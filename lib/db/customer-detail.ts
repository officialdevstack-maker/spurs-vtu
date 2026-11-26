import "server-only";
import { getPool } from "@/lib/db";
import type { AuditRecord } from "@/lib/admin/audit";
import type { CustomerDetail, CustomerFlag } from "@/lib/admin/customer-detail";
import type { Transaction, TxService, TxStatus } from "@/lib/dashboard-data";
import { listCustomerTickets } from "@/lib/db/support";

const changed = (r: { rowCount: number | null }) => (r.rowCount ?? 0) > 0;

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const pool = getPool();
  const head = await pool.query<{
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
    phone: string | null;
    status: "active" | "suspended";
    created_at: Date;
    last_seen_at: Date;
    package_id: string;
    package_name: string | null;
    fraud_exempt: boolean;
    referral_code: string | null;
    is_staff: boolean;
  }>(
    `select c.id, c.name, c.username, c.email, c.phone, c.status, c.created_at, c.last_seen_at,
            c.package_id, p.name as package_name, c.fraud_exempt, c.referral_code,
            exists(select 1 from staff_members s where s.customer_id = c.id) as is_staff
     from customers c
     left join packages p on p.id = c.package_id
     where c.id = $1`,
    [id],
  );
  const c = head.rows[0];
  if (!c) return null;

  const [wallet, cashback, pin, spend, txs, referrer, invited, flags, audit, tickets] = await Promise.all([
    pool.query<{ balance_kobo: string }>("select balance_kobo::text from vtu_wallets where customer_id = $1", [id]),
    pool.query<{ balance_kobo: string }>("select balance_kobo::text from cashback_wallets where customer_id = $1", [id]),
    pool.query<{ has_pin: boolean; locked_until: Date | null }>(
      "select pin_hash is not null as has_pin, locked_until from customer_pins where customer_id = $1",
      [id],
    ),
    pool.query<{ purchases: string; total: string }>(
      `select count(*)::text as purchases, coalesce(sum(amount), 0)::text as total
       from transactions
       where customer_id = $1 and direction = 'debit' and status = 'success'`,
      [id],
    ),
    pool.query<{
      id: string;
      service: TxService;
      title: string;
      detail: string;
      amount: string;
      direction: "debit" | "credit";
      status: TxStatus;
      created_at: Date;
    }>(
      `select id, service, title, detail, amount, direction, status, created_at
       from transactions where customer_id = $1 order by created_at desc, id limit 10`,
      [id],
    ),
    pool.query<{ referrer: string | null; status: "pending" | "rewarded" }>(
      `select coalesce('@' || r.username, r.name) as referrer, f.status
       from referrals f join customers r on r.id = f.referrer_id
       where f.referee_id = $1`,
      [id],
    ),
    pool.query<{ invited: string; rewarded: string }>(
      `select count(*)::text as invited, (count(*) filter (where status = 'rewarded'))::text as rewarded
       from referrals where referrer_id = $1`,
      [id],
    ),
    pool.query<{
      id: string;
      rule: CustomerFlag["rule"];
      action: CustomerFlag["action"];
      status: CustomerFlag["status"];
      resolution: CustomerFlag["resolution"];
      created_at: Date;
    }>(
      `select id, rule, action, status, resolution, created_at
       from fraud_flags where customer_id = $1 order by created_at desc limit 10`,
      [id],
    ),
    pool.query<{
      id: string;
      actor_label: string;
      action: string;
      target: string | null;
      summary: string;
      meta: Record<string, unknown>;
      created_at: Date;
    }>(
      `select id, actor_label, action, target, summary, meta, created_at
       from admin_audit_log where target = $1 order by created_at desc, id limit 15`,
      [id],
    ),
    listCustomerTickets(id, 5),
  ]);

  const transactions: Transaction[] = txs.rows.map((row) => ({
    id: row.id,
    service: row.service,
    title: row.title,
    detail: row.detail,
    amount: Number(row.amount),
    direction: row.direction,
    status: row.status,
    at: row.created_at.toISOString(),
  }));

  const auditRows: AuditRecord[] = audit.rows.map((row) => ({
    id: row.id,
    actor: row.actor_label,
    action: row.action,
    target: row.target,
    summary: row.summary,
    meta: row.meta,
    at: row.created_at.toISOString(),
  }));

  return {
    id: c.id,
    name: c.name,
    username: c.username,
    email: c.email,
    phone: c.phone,
    status: c.status,
    createdAt: c.created_at.toISOString(),
    lastSeenAt: c.last_seen_at.toISOString(),
    packageId: c.package_id,
    packageName: c.package_name ?? c.package_id,
    fraudExempt: c.fraud_exempt,
    referralCode: c.referral_code,
    isStaff: c.is_staff,
    walletBalance: Number(BigInt(wallet.rows[0]?.balance_kobo ?? "0")) / 100,
    cashbackBalance: Number(BigInt(cashback.rows[0]?.balance_kobo ?? "0")) / 100,
    pin: {
      hasPin: pin.rows[0]?.has_pin ?? false,
      lockedUntil:
        pin.rows[0]?.locked_until && pin.rows[0].locked_until.getTime() > Date.now()
          ? pin.rows[0].locked_until.toISOString()
          : null,
    },
    spend: { purchases: Number(spend.rows[0]?.purchases ?? 0), total: Number(spend.rows[0]?.total ?? 0) },
    transactions,
    referral: {
      referrer: referrer.rows[0]?.referrer ?? null,
      status: referrer.rows[0]?.status ?? null,
      invited: Number(invited.rows[0]?.invited ?? 0),
      rewarded: Number(invited.rows[0]?.rewarded ?? 0),
    },
    tickets,
    flags: flags.rows.map((row) => ({
      id: row.id,
      rule: row.rule,
      action: row.action,
      status: row.status,
      resolution: row.resolution,
      at: row.created_at.toISOString(),
    })),
    audit: auditRows,
  };
}

export async function customerExists(id: string): Promise<boolean> {
  const { rowCount } = await getPool().query("select 1 from customers where id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

export async function setFraudExempt(id: string, exempt: boolean): Promise<boolean> {
  return changed(await getPool().query("update customers set fraud_exempt = $2 where id = $1", [id, exempt]));
}
