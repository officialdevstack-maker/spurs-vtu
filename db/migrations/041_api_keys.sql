create table if not exists vtu_api_keys (
  id           text primary key,
  customer_id  text not null references customers(id) on delete cascade,
  name         text not null,
  prefix       text not null,
  key_hash     text not null unique,
  scopes       text[] not null,
  ip_allowlist text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists vtu_api_keys_customer_idx on vtu_api_keys (customer_id, created_at desc);

create table if not exists vtu_api_rate_limits (
  key_id       text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (key_id, window_start)
);
