import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type {
  AuthType,
  HttpMethod,
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
  const [providers, endpoints] = await Promise.all([
    pool.query<ProviderRow>(
      `select id, name, kind, base_url, auth_type, auth_name, auth_username,
              secret_enc is not null as has_secret, enabled, priority, timeout_ms
       from providers order by priority, name`,
    ),
    pool.query<EndpointRow>(
      "select id, provider_id, service, method, path, body_template, active from provider_endpoints order by service",
    ),
  ]);

  const byProvider = new Map<string, ProviderEndpoint[]>();
  for (const row of endpoints.rows) {
    const list = byProvider.get(row.provider_id) ?? [];
    list.push(toEndpoint(row));
    byProvider.set(row.provider_id, list);
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
  const { rows } = await getPool().query<
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
  );

  const row = rows[0];
  if (!row) return null;

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
  };
}
