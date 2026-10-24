import "server-only";
import { getPool } from "@/lib/db";
import type { Transaction, TxService, TxStatus } from "@/lib/dashboard-data";

export type NewTransaction = {
  id: string;
  customerId: string;
  service: TxService;
  title: string;
  detail: string;
  amount: number;
  cost: number | null;
  networkId: string | null;
  planId: string | null;
  providerId: string | null;
  phone: string | null;
};

export type HistoryFilters = {
  query: string;
  status: TxStatus | "all";
  service: TxService | "all";
  page: number;
  pageSize: number;
};

export type AdminDetail = {
  customerId: string;
  username: string | null;
  customerName: string | null;
  cost: number | null;
  providerName: string | null;
};

export type HistoryItem = Transaction & {
  failureReason: string | null;
  debited: boolean;
  refunded: boolean;
  admin?: AdminDetail;
};

type HistoryRow = {
  id: string;
  service: TxService;
  title: string;
  detail: string;
  amount: string;
  direction: "debit" | "credit";
  status: TxStatus;
  created_at: Date;
  failure_reason: string | null;
  debited: boolean;
  refunded: boolean;
  cost: string | null;
  customer_id: string;
  username: string | null;
  customer_name: string | null;
  provider_name: string | null;
};

export async function startTransaction(transaction: NewTransaction): Promise<boolean> {
  const result = await getPool().query(
    `insert into transactions
       (id, customer_id, service, title, detail, amount, cost, network_id, plan_id, provider_id, phone)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (id) do nothing`,
    [
      transaction.id,
      transaction.customerId,
      transaction.service,
      transaction.title,
      transaction.detail,
      transaction.amount,
      transaction.cost,
      transaction.networkId,
      transaction.planId,
      transaction.providerId,
      transaction.phone,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function findTransaction(id: string, customerId: string) {
  const { rows } = await getPool().query<{
    status: TxStatus;
    title: string;
    failure_reason: string | null;
  }>("select status, title, failure_reason from transactions where id = $1 and customer_id = $2", [id, customerId]);
  const row = rows[0];
  return row ? { status: row.status, title: row.title, failureReason: row.failure_reason } : null;
}

export async function markDebited(id: string): Promise<void> {
  await getPool().query("update transactions set debited = true, updated_at = now() where id = $1", [id]);
}

export async function markRefunded(id: string): Promise<void> {
  await getPool().query(
    "update transactions set refunded = true, updated_at = now() where id = $1 and status = 'failed'",
    [id],
  );
}

export async function finishTransaction(
  id: string,
  status: TxStatus,
  details: { reason?: string; response?: string } = {},
): Promise<void> {
  await getPool().query(
    `update transactions
     set status = $2, failure_reason = $3, provider_response = $4, updated_at = now()
     where id = $1 and status = 'pending'`,
    [id, status, details.reason ?? null, details.response?.slice(0, 2000) ?? null],
  );
}

type TransactionRow = {
  id: string;
  service: TxService;
  title: string;
  detail: string;
  amount: string;
  direction: "debit" | "credit";
  status: TxStatus;
  created_at: Date;
};

async function queryHistory(filters: HistoryFilters, customerId: string | null) {
  const pool = getPool();
  const escaped = filters.query.trim().replace(/[!%_]/g, "!$&");
  const search = escaped ? `%${escaped}%` : null;
  const params = [
    customerId,
    filters.status === "all" ? null : filters.status,
    filters.service === "all" ? null : filters.service,
    search,
  ];
  const from = `from transactions t
    join customers c on c.id = t.customer_id
    left join providers p on p.id = t.provider_id
    where ($1::text is null or t.customer_id = $1)
      and ($2::text is null or t.status = $2)
      and ($3::text is null or t.service = $3)
      and ($4::text is null
           or t.title ilike $4 escape '!' or t.detail ilike $4 escape '!' or t.id ilike $4 escape '!'
           or c.username ilike $4 escape '!' or c.email ilike $4 escape '!')`;

  const count = await pool.query<{ count: string }>(`select count(*)::text as count ${from}`, params);
  const total = Number(count.rows[0]?.count ?? "0");
  const pageSize = Math.max(1, Math.min(filters.pageSize, 100));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page), pageCount);

  const { rows } = await pool.query<HistoryRow>(
    `select t.id, t.service, t.title, t.detail, t.amount, t.direction, t.status, t.created_at,
            t.failure_reason, t.debited, t.refunded, t.cost, t.customer_id,
            c.username, c.name as customer_name, p.name as provider_name
     ${from}
     order by t.created_at desc, t.id
     limit $5 offset $6`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { rows, total, page };
}

function toHistoryItem(row: HistoryRow, admin: boolean): HistoryItem {
  return {
    id: row.id,
    service: row.service,
    title: row.title,
    detail: row.detail,
    amount: Number(row.amount),
    direction: row.direction,
    status: row.status,
    at: row.created_at.toISOString(),
    failureReason: row.failure_reason,
    debited: row.debited,
    refunded: row.refunded,
    ...(admin
      ? {
          admin: {
            customerId: row.customer_id,
            username: row.username,
            customerName: row.customer_name,
            cost: row.cost === null ? null : Number(row.cost),
            providerName: row.provider_name,
          },
        }
      : {}),
  };
}

export async function listCustomerTransactions(customerId: string, filters: HistoryFilters) {
  const { rows, total, page } = await queryHistory(filters, customerId);
  return { items: rows.map((row) => toHistoryItem(row, false)), total, page };
}

export async function listAdminTransactions(filters: HistoryFilters) {
  const { rows, total, page } = await queryHistory(filters, null);
  return { items: rows.map((row) => toHistoryItem(row, true)), total, page };
}

export async function getRecentTransactions(customerId: string, limit = 5): Promise<Transaction[]> {
  const { rows } = await getPool().query<TransactionRow>(
    `select id, service, title, detail, amount, direction, status, created_at
     from transactions
     where customer_id = $1
     order by created_at desc, id
     limit $2`,
    [customerId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    service: row.service,
    title: row.title,
    detail: row.detail,
    amount: Number(row.amount),
    direction: row.direction,
    status: row.status,
    at: row.created_at.toISOString(),
  }));
}

export type ServiceSales = {
  service: TxService;
  sold: number;
  pending: number;
  failed: number;
  revenue: number;
  cost: number;
  profit: number;
  /** Successful sales with no cost recorded. They are left out of profit. */
  unknownCost: number;
};
export type DailySales = { day: string; sold: number; revenue: number; profit: number };
export type TopItem = { title: string; sold: number; revenue: number };
export type SalesReport = { services: ServiceSales[]; days: DailySales[]; top: TopItem[] };

const SALES_WHERE = `where t.direction = 'debit'
    and t.created_at >= ($1::date)::timestamp at time zone 'Africa/Lagos'
    and t.created_at < (($2::date + 1)::timestamp) at time zone 'Africa/Lagos'`;

/** Sales between two Lagos dates, inclusive. Only successful debits count as revenue. */
export async function getSalesReport(from: string, to: string): Promise<SalesReport> {
  const pool = getPool();
  const params = [from, to];
  const [services, days, top] = await Promise.all([
    pool.query<{
      service: TxService;
      sold: string;
      pending: string;
      failed: string;
      revenue: string;
      cost: string;
      profit: string;
      unknown_cost: string;
    }>(
      `select t.service,
              count(*) filter (where t.status = 'success') as sold,
              count(*) filter (where t.status = 'pending') as pending,
              count(*) filter (where t.status = 'failed') as failed,
              coalesce(sum(t.amount) filter (where t.status = 'success'), 0) as revenue,
              coalesce(sum(t.cost) filter (where t.status = 'success'), 0) as cost,
              coalesce(sum(t.amount - t.cost) filter (where t.status = 'success' and t.cost is not null), 0) as profit,
              count(*) filter (where t.status = 'success' and t.cost is null) as unknown_cost
       from transactions t
       ${SALES_WHERE}
       group by t.service
       order by revenue desc`,
      params,
    ),
    pool.query<{ day: string; sold: string; revenue: string; profit: string }>(
      `select (t.created_at at time zone 'Africa/Lagos')::date::text as day,
              count(*) as sold,
              coalesce(sum(t.amount), 0) as revenue,
              coalesce(sum(t.amount - t.cost) filter (where t.cost is not null), 0) as profit
       from transactions t
       ${SALES_WHERE} and t.status = 'success'
       group by 1
       order by 1 desc`,
      params,
    ),
    pool.query<{ title: string; sold: string; revenue: string }>(
      `select t.title, count(*) as sold, sum(t.amount) as revenue
       from transactions t
       ${SALES_WHERE} and t.status = 'success'
       group by t.title
       order by sold desc, revenue desc
       limit 10`,
      params,
    ),
  ]);

  return {
    services: services.rows.map((row) => ({
      service: row.service,
      sold: Number(row.sold),
      pending: Number(row.pending),
      failed: Number(row.failed),
      revenue: Number(row.revenue),
      cost: Number(row.cost),
      profit: Number(row.profit),
      unknownCost: Number(row.unknown_cost),
    })),
    days: days.rows.map((row) => ({
      day: row.day,
      sold: Number(row.sold),
      revenue: Number(row.revenue),
      profit: Number(row.profit),
    })),
    top: top.rows.map((row) => ({ title: row.title, sold: Number(row.sold), revenue: Number(row.revenue) })),
  };
}
