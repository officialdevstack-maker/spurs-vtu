import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type {
  AuthType,
  HttpMethod,
  NetworkOption,
  Provider,
  ProviderEndpoint,
  ProviderKind,
  ProviderService,
} from "@/lib/admin/providers";

export type ProviderFields = {
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  authType: AuthType;
  authName: string;
  authUsername: string;
  secret: string;
  enabled: boolean;
  priority: number;
  timeoutMs: number;
};

export type EndpointFields = {
  service: ProviderService;
  method: HttpMethod;
  path: string;
  bodyTemplate: string;
  active: boolean;
};

export type NetworkCodeFields = { networkId: string; code: string };

type ProviderRow = {
  id: string;
  name: string;
  kind: ProviderKind;
  base_url: string;
  auth_type: AuthType;
  auth_name: string;
  auth_username: string;
  has_secret: boolean;
  enabled: boolean;
  priority: number;
  timeout_ms: number;
};

type EndpointRow = {
  id: string;
  provider_id: string;
  service: ProviderService;
  method: HttpMethod;
  path: string;
  body_template: string;
  active: boolean;
};

const changed = (result: { rowCount: number | null }) => (result.rowCount ?? 0) > 0;

const toEndpoint = (row: EndpointRow): ProviderEndpoint => ({
  id: row.id,
  service: row.service,
  method: row.method,
  path: row.path,
  bodyTemplate: row.body_template,
  active: row.active,
});

export async function getProviders(): Promise<Provider[]> {
  const pool = getPool();
  const [providers, endpoints, codes] = await Promise.all([
    pool.query<ProviderRow>(
      `select id, name, kind, base_url, auth_type, auth_name, auth_username,
              secret_enc is not null as has_secret, enabled, priority, timeout_ms
       from providers order by priority, name`,
    ),
    pool.query<EndpointRow>(
      "select id, provider_id, service, method, path, body_template, active from provider_endpoints order by service",
    ),
    pool.query<{ provider_id: string; network_id: string; code: string }>(
      "select provider_id, network_id, code from provider_network_codes",
    ),
  ]);

  const byProvider = new Map<string, ProviderEndpoint[]>();
  for (const row of endpoints.rows) {
    const list = byProvider.get(row.provider_id) ?? [];
    list.push(toEndpoint(row));
    byProvider.set(row.provider_id, list);
  }

  const codesByProvider = new Map<string, Record<string, string>>();
  for (const row of codes.rows) {
    const map = codesByProvider.get(row.provider_id) ?? {};
    map[row.network_id] = row.code;
    codesByProvider.set(row.provider_id, map);
  }

  return providers.rows.map((provider) => ({
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    baseUrl: provider.base_url,
    authType: provider.auth_type,
    authName: provider.auth_name,
    authUsername: provider.auth_username,
    hasSecret: provider.has_secret,
    enabled: provider.enabled,
    priority: provider.priority,
    timeoutMs: provider.timeout_ms,
    networkCodes: codesByProvider.get(provider.id) ?? {},
    endpoints: byProvider.get(provider.id) ?? [],
  }));
}

export async function createProvider(id: string, provider: ProviderFields): Promise<boolean> {
  return changed(
    await getPool().query(
      `insert into providers
         (id, name, kind, base_url, auth_type, auth_name, auth_username, secret_enc, enabled, priority, timeout_ms)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        provider.name,
        provider.kind,
        provider.baseUrl,
        provider.authType,
        provider.authName,
        provider.authUsername,
        provider.secret ? encryptSecret(provider.secret) : null,
        provider.enabled,
        provider.priority,
        provider.timeoutMs,
      ],
    ),
  );
}

export async function updateProvider(id: string, provider: ProviderFields): Promise<boolean> {
  return changed(
    await getPool().query(
      `update providers set
         name = $2, kind = $3, base_url = $4, auth_type = $5, auth_name = $6, auth_username = $7,
         secret_enc = case when $5 = 'none' then null else coalesce($8, secret_enc) end,
         enabled = $9, priority = $10, timeout_ms = $11, updated_at = now()
       where id = $1`,
      [
        id,
        provider.name,
        provider.kind,
        provider.baseUrl,
        provider.authType,
        provider.authName,
        provider.authUsername,
        provider.secret ? encryptSecret(provider.secret) : null,
        provider.enabled,
        provider.priority,
        provider.timeoutMs,
      ],
    ),
  );
}

export async function setProviderEnabled(id: string, enabled: boolean): Promise<boolean> {
  return changed(
    await getPool().query("update providers set enabled = $2, updated_at = now() where id = $1", [id, enabled]),
  );
}

export async function deleteProvider(id: string): Promise<boolean> {
  return changed(await getPool().query("delete from providers where id = $1", [id]));
}

export async function saveEndpoint(providerId: string, endpoint: EndpointFields): Promise<boolean> {
  return changed(
    await getPool().query(
      `insert into provider_endpoints (id, provider_id, service, method, path, body_template, active)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (provider_id, service) do update
         set method = excluded.method, path = excluded.path,
             body_template = excluded.body_template, active = excluded.active`,
      [
        randomUUID(),
        providerId,
        endpoint.service,
        endpoint.method,
        endpoint.path,
        endpoint.bodyTemplate,
        endpoint.active,
      ],
    ),
  );
}

export async function setEndpointActive(
  providerId: string,
  endpointId: string,
  active: boolean,
): Promise<boolean> {
  return changed(
    await getPool().query("update provider_endpoints set active = $3 where id = $1 and provider_id = $2", [
      endpointId,
      providerId,
      active,
    ]),
  );
}

export async function deleteEndpoint(providerId: string, endpointId: string): Promise<boolean> {
  return changed(
    await getPool().query("delete from provider_endpoints where id = $1 and provider_id = $2", [endpointId, providerId]),
  );
}

export async function getProviderForCall(providerId: string, service: ProviderService) {
  const [providerResult, codesResult] = await Promise.all([
    getPool().query<
      Omit<ProviderRow, "has_secret"> & {
        secret_enc: string | null;
        endpoint_method: HttpMethod;
        endpoint_path: string;
        endpoint_body: string;
      }
    >(
      `select p.id, p.name, p.kind, p.base_url, p.auth_type, p.auth_name, p.auth_username, p.secret_enc,
              p.enabled, p.priority, p.timeout_ms,
              e.method as endpoint_method, e.path as endpoint_path, e.body_template as endpoint_body
       from providers p
       join provider_endpoints e on e.provider_id = p.id and e.service = $2 and e.active
       where p.id = $1 and p.enabled`,
      [providerId, service],
    ),
    getPool().query<{ network_id: string; code: string }>(
      "select network_id, code from provider_network_codes where provider_id = $1",
      [providerId],
    ),
  ]);

  const row = providerResult.rows[0];
  if (!row) return null;

  const networkCodes = Object.fromEntries(codesResult.rows.map((item) => [item.network_id, item.code]));

  return {
    id: row.id,
    baseUrl: row.base_url,
    authType: row.auth_type,
    authName: row.auth_name,
    authUsername: row.auth_username,
    secret: row.secret_enc ? decryptSecret(row.secret_enc) : "",
    timeoutMs: row.timeout_ms,
    method: row.endpoint_method,
    path: row.endpoint_path,
    bodyTemplate: row.endpoint_body,
    networkCodes,
  };
}

export async function listNetworkOptions(): Promise<NetworkOption[]> {
  const { rows } = await getPool().query<NetworkOption>(
    "select id, name from networks order by sort_order, name",
  );
  return rows;
}

export async function saveNetworkCodes(providerId: string, codes: NetworkCodeFields[]): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const exists = await client.query("select 1 from providers where id = $1", [providerId]);
    if (!exists.rowCount) {
      await client.query("rollback");
      return false;
    }
    await client.query("delete from provider_network_codes where provider_id = $1", [providerId]);
    if (codes.length > 0) {
      await client.query(
        `insert into provider_network_codes (provider_id, network_id, code)
         select $1, t.network_id, t.code
         from unnest($2::text[], $3::text[]) as t(network_id, code)`,
        [providerId, codes.map((code) => code.networkId), codes.map((code) => code.code)],
      );
    }
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getNetworkCode(providerId: string, networkId: string): Promise<string | number> {
  const { rows } = await getPool().query<{ code: string }>(
    "select code from provider_network_codes where provider_id = $1 and network_id = $2",
    [providerId, networkId],
  );
  const code = rows[0]?.code;
  if (!code) return networkId;
  return /^\d+$/.test(code) ? Number(code) : code;
}
