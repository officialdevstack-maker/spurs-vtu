import "server-only";
import { getPool } from "@/lib/db";

export type CustomerStatus = "active" | "suspended";

export type Customer = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  status: CustomerStatus;
  createdAt: string;
  lastSeenAt: string;
};

export type CustomerFilters = {
  query: string;
  status: CustomerStatus | "all";
  page: number;
  pageSize: number;
};

type CustomerRow = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  status: CustomerStatus;
  created_at: Date;
  last_seen_at: Date;
};

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
  };
}

export async function listCustomers(filters: CustomerFilters): Promise<{
  customers: Customer[];
  total: number;
  page: number;
}> {
  const pool = getPool();
  const normalizedQuery = filters.query.trim().replace(/[!%_]/g, "!$&");
  const search = normalizedQuery ? `%${normalizedQuery}%` : null;
  const status = filters.status === "all" ? null : filters.status;
  const pageSize = Math.max(1, Math.min(filters.pageSize, 100));
  const params = [search, status];
  const where = `where ($1::text is null or name ilike $1 escape '!'
          or username ilike $1 escape '!' or email ilike $1 escape '!')
          and ($2::text is null or status = $2)`;
  const count = await pool.query<{ count: string }>(
    `select count(*)::text as count from customers ${where}`,
    params,
  );
  const total = Number(count.rows[0]?.count ?? "0");
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const maxPage = Math.floor(Number.MAX_SAFE_INTEGER / pageSize);
  const page = Math.min(Math.max(1, filters.page), pageCount, maxPage);
  const offset = (page - 1) * pageSize;
  const rows = await pool.query<CustomerRow>(
    `select id, name, username, email, status, created_at, last_seen_at
       from customers
       ${where}
      order by created_at desc, id
      limit $3 offset $4`,
    [...params, pageSize, offset],
  );

  return {
    customers: rows.rows.map(toCustomer),
    total,
    page,
  };
}

export async function syncCustomer(user: {
  sub: string;
  name?: string;
  username?: string;
  email?: string;
}): Promise<CustomerStatus> {
  const { rows } = await getPool().query<{ status: CustomerStatus }>(
    `insert into customers (id, name, username, email)
     values ($1, $2, $3, $4)
     on conflict (id) do update
       set name = excluded.name,
           username = excluded.username,
           email = excluded.email,
           last_seen_at = now()
     returning status`,
    [user.sub, user.name ?? null, user.username ?? null, user.email ?? null],
  );
  const customer = rows[0];
  if (!customer) throw new Error("Customer sync did not return a row.");
  return customer.status;
}

export async function updateCustomerStatus(id: string, status: CustomerStatus): Promise<boolean> {
  const { rowCount } = await getPool().query(
    "update customers set status = $2 where id = $1",
    [id, status],
  );
  return rowCount === 1;
}
