create table if not exists device_tokens (
  id           text primary key,
  customer_id  text not null references customers(id) on delete cascade,
  kind         text not null default 'web' check (kind in ('web', 'fcm')),
  token        text not null unique,
  p256dh       text,
  auth         text,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists device_tokens_customer_idx on device_tokens (customer_id);
