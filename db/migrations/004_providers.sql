create table if not exists providers (
  id             text primary key,
  name           text not null,
  kind           text not null check (kind in ('api', 'simhost')),
  base_url       text not null,
  auth_type      text not null check (auth_type in ('bearer', 'api_key_header', 'basic', 'query_param', 'none')),
  auth_name      text not null default '',
  auth_username  text not null default '',
  secret_enc     text,
  enabled        boolean not null default true,
  priority       int not null default 1 check (priority between 1 and 999),
  timeout_ms     int not null default 15000 check (timeout_ms between 1000 and 60000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists provider_endpoints (
  id             text primary key,
  provider_id    text not null references providers(id) on delete cascade,
  service        text not null check (service in ('airtime', 'data', 'cable', 'electricity', 'exam', 'balance')),
  method         text not null default 'POST' check (method in ('GET', 'POST')),
  path           text not null,
  body_template  text not null default '',
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (provider_id, service)
);

create index if not exists provider_endpoints_provider_idx on provider_endpoints (provider_id);
