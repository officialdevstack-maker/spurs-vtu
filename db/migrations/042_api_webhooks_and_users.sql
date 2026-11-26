alter table vtu_api_rate_limits drop constraint if exists vtu_api_rate_limits_key_id_fkey;

create table if not exists api_webhooks (
  customer_id text primary key references customers(id) on delete cascade,
  url text not null,
  secret_enc text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists api_webhook_deliveries (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  transaction_id text not null references transactions(id) on delete cascade,
  event text not null check (event in ('order.success', 'order.failed')),
  payload text not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  http_status int,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (transaction_id, event)
);
create index if not exists api_webhook_deliveries_due_idx
  on api_webhook_deliveries (next_attempt_at) where status = 'pending';
create index if not exists api_webhook_deliveries_customer_idx
  on api_webhook_deliveries (customer_id, created_at desc);
