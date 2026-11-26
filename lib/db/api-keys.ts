import "server-only";
import { getPool } from "@/lib/db";
import { MAX_ACTIVE_KEYS, isApiScope, type ApiKeyRecord, type ApiScope } from "@/lib/api/keys";

export async function listApiKeys(customerId: string): Promise<ApiKeyRecord[]> {
  const { rows } = await getPool().query<{
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    ip_allowlist: string[];
    last_used_at: Date | null;
    created_at: Date;
  }>(
    `select id, name, prefix, scopes, ip_allowlist, last_used_at, created_at
     from api_keys where customer_id = $1 and revoked_at is null
     order by created_at desc`,
    [customerId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    scopes: r.scopes.filter(isApiScope),
    ipAllowlist: r.ip_allowlist,
    lastUsedAt: r.last_used_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function createApiKey(input: {
  id: string;
  customerId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: ApiScope[];
  ipAllowlist: string[];
}): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select 1 from customers where id = $1 for update", [input.customerId]);
    const active = await client.query<{ n: string }>(
      "select count(*)::text as n from api_keys where customer_id = $1 and revoked_at is null",
      [input.customerId],
    );
    if (Number(active.rows[0].n) >= MAX_ACTIVE_KEYS) {
      await client.query("rollback");
      return false;
    }
    await client.query(
      `insert into api_keys (id, customer_id, name, prefix, key_hash, scopes, ip_allowlist)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [input.id, input.customerId, input.name, input.prefix, input.keyHash, input.scopes, input.ipAllowlist],
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

export async function revokeApiKey(customerId: string, id: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    "update api_keys set revoked_at = now() where id = $1 and customer_id = $2 and revoked_at is null",
    [id, customerId],
  );
  return (rowCount ?? 0) > 0;
}

export type ApiKeyAuth = {
  keyId: string;
  customerId: string;
  customerName: string | null;
  packageId: string;
  scopes: ApiScope[];
  ipAllowlist: string[];
  active: boolean;
};

export async function findApiKeyByHash(keyHash: string): Promise<ApiKeyAuth | null> {
  const { rows } = await getPool().query<{
    id: string;
    customer_id: string;
    name: string | null;
    package_id: string;
    scopes: string[];
    ip_allowlist: string[];
    status: string;
  }>(
    `select k.id, k.customer_id, c.name, c.package_id, k.scopes, k.ip_allowlist, c.status
     from api_keys k join customers c on c.id = k.customer_id
     where k.key_hash = $1 and k.revoked_at is null`,
    [keyHash],
  );
  const row = rows[0];
  return row
    ? {
        keyId: row.id,
        customerId: row.customer_id,
        customerName: row.name,
        packageId: row.package_id,
        scopes: row.scopes.filter(isApiScope),
        ipAllowlist: row.ip_allowlist,
        active: row.status === "active",
      }
    : null;
}

export async function touchApiKey(id: string): Promise<void> {
  await getPool().query("update api_keys set last_used_at = now() where id = $1", [id]);
}

export async function hitRateLimit(keyId: string, windowSeconds: number): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ count: number }>(
    `insert into api_rate_limits (key_id, window_start, count)
     values ($1, to_timestamp(floor(extract(epoch from now()) / $2::int) * $2::int), 1)
     on conflict (key_id, window_start) do update set count = api_rate_limits.count + 1
     returning count`,
    [keyId, windowSeconds],
  );
  if (Math.random() < 0.01) {
    await pool.query("delete from api_rate_limits where window_start < now() - interval '1 hour'").catch(() => undefined);
  }
  return rows[0].count;
}
