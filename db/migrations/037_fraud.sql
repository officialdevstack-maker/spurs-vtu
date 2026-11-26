alter table customers add column if not exists fraud_exempt boolean not null default false;

create table if not exists fraud_rules (
  rule       text primary key check (rule in ('velocity', 'repeated_failures', 'shared_phone', 'abnormal_amount')),
  enabled    boolean not null default true,
  action     text not null default 'flag' check (action in ('flag', 'hold', 'block')),
  params     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into fraud_rules (rule, enabled, action, params) values
  ('velocity',          true, 'hold', '{"max": 10, "minutes": 10}'),
  ('repeated_failures', true, 'flag', '{"max": 5, "minutes": 30}'),
  ('shared_phone',      true, 'flag', '{"max": 3}'),
  ('abnormal_amount',   true, 'flag', '{"maxAmount": 100000, "avgMultiple": 5}')
on conflict do nothing;

create table if not exists fraud_flags (
  id          text primary key,
  customer_id text not null references customers(id) on delete cascade,
  rule        text not null,
  action      text not null check (action in ('flag', 'hold', 'block')),
  reference   text,
  detail      jsonb not null default '{}'::jsonb,
  status      text not null default 'open' check (status in ('open', 'reviewed')),
  resolution  text check (resolution in ('dismissed', 'confirmed')),
  note        text,
  reviewed_by text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists fraud_flags_one_open_idx on fraud_flags (customer_id, rule) where status = 'open';
create index if not exists fraud_flags_open_idx on fraud_flags (created_at desc) where status = 'open';
