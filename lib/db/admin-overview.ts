import "server-only";
import { getPool } from "@/lib/db";
import type { TxService, TxStatus } from "@/lib/dashboard-data";
import type { AdminOverview, AdminTransaction } from "@/lib/admin/overview-data";
import { SERVICE_OPTIONS } from "@/lib/transactions-history";

const serviceLabel = (id: string) => SERVICE_OPTIONS.find((option) => option.id === id)?.label ?? id;

const BOUNDS = `cross join (
  select date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos' as day_start,
         date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos' as month_start
) b`;

export async function getAdminOverview(): Promise<AdminOverview> {
  const pool = getPool();

  const [customers, today, attention, month, recent] = await Promise.all([
    pool.query<{ total: string; new_this_week: string }>(
      `select count(*)::text as total,
              (count(*) filter (where created_at >= now() - interval '7 days'))::text as new_this_week
       from customers`,
    ),
    pool.query<{ transactions: string; success: string; failed: string; revenue: string }>(
      `select count(*)::text as transactions,
              (count(*) filter (where t.status = 'success'))::text as success,
              (count(*) filter (where t.status = 'failed'))::text as failed,
              coalesce(sum(t.amount) filter (where t.status = 'success'), 0)::text as revenue
       from transactions t ${BOUNDS}
       where t.direction = 'debit' and t.created_at >= b.day_start`,
    ),
    pool.query<{ pending: string; failed: string }>(
      `select (count(*) filter (where status = 'pending'))::text as pending,
              (count(*) filter (where status = 'failed'))::text as failed
       from transactions
       where direction = 'debit' and created_at >= now() - interval '24 hours'`,
    ),
    pool.query<{ service: TxService; amount: string }>(
      `select t.service, sum(t.amount)::text as amount
       from transactions t ${BOUNDS}
       where t.direction = 'debit' and t.status = 'success' and t.created_at >= b.month_start
       group by t.service`,
    ),
    pool.query<{
      id: string;
      service: TxService;
      title: string;
      amount: string;
      direction: "debit" | "credit";
      status: TxStatus;
      created_at: Date;
      username: string | null;
      name: string | null;
    }>(
      `select t.id, t.service, t.title, t.amount, t.direction, t.status, t.created_at, c.username, c.name
       from transactions t
       join customers c on c.id = t.customer_id
       order by t.created_at desc, t.id
       limit 6`,
    ),
  ]);

  const todayRow = today.rows[0];
  const success = Number(todayRow?.success ?? 0);
  const failed = Number(todayRow?.failed ?? 0);
  const settled = success + failed;

  const revenueByService = month.rows.map((row) => ({
    label: serviceLabel(row.service),
    amount: Number(row.amount),
  }));

  const transactions: AdminTransaction[] = recent.rows.map((row) => ({
    id: row.id,
    service: row.service,
    title: row.title,
    username: row.username ?? row.name ?? "unknown",
    amount: Number(row.amount),
    direction: row.direction,
    status: row.status,
    at: row.created_at.toISOString(),
  }));

  return {
    users: {
      total: Number(customers.rows[0]?.total ?? 0),
      newThisWeek: Number(customers.rows[0]?.new_this_week ?? 0),
    },
    walletFloat: null,
    today: {
      revenue: Number(todayRow?.revenue ?? 0),
      transactions: Number(todayRow?.transactions ?? 0),
      successRate: settled > 0 ? success / settled : 0,
    },
    attention: {
      pending: Number(attention.rows[0]?.pending ?? 0),
      failed: Number(attention.rows[0]?.failed ?? 0),
    },
    revenueByService,
    monthRevenue: revenueByService.reduce((sum, item) => sum + item.amount, 0),
    recent: transactions,
  };
}
