alter table provider_endpoints drop constraint if exists provider_endpoints_service_check;
alter table provider_endpoints
  add constraint provider_endpoints_service_check
  check (service in ('airtime', 'data', 'cable', 'cable_verify', 'electricity', 'electricity_verify', 'exam', 'balance', 'auth'));

alter table provider_endpoints add column if not exists response_map jsonb not null default '{}'::jsonb;

alter table providers drop constraint if exists providers_auth_type_check;
alter table providers
  add constraint providers_auth_type_check
  check (auth_type in ('bearer', 'api_key_header', 'basic', 'query_param', 'login', 'none'));

create table if not exists provider_tokens (
  provider_id text primary key references providers(id) on delete cascade,
  token_enc text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
