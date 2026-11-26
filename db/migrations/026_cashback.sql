create table if not exists cashback_wallets (
  customer_id  text primary key references customers(id) on delete restrict,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  updated_at   timestamptz not null default now()
);

create table if not exists cashback_ledger (
  reference    text primary key,
  customer_id  text not null references customers(id) on delete restrict,
  direction    text not null check (direction in ('credit', 'debit')),
  amount_kobo  bigint not null check (amount_kobo > 0),
  source       text not null check (source in ('earn', 'spend', 'restore')),
  service      text,
  created_at   timestamptz not null default now()
);
create index if not exists cashback_ledger_customer_idx on cashback_ledger (customer_id, created_at desc);
create index if not exists cashback_ledger_earn_idx
  on cashback_ledger (customer_id, service, created_at) where source = 'earn';

create table if not exists cashback_rules (
  service      text primary key check (service in ('airtime', 'data', 'cable', 'electricity')),
  enabled      boolean not null default false,
  percent      numeric(5,2) not null default 0 check (percent between 0 and 20),
  min_spend    numeric(12,2) not null default 0 check (min_spend >= 0),
  monthly_cap  numeric(12,2) check (monthly_cap is null or monthly_cap > 0)
);

insert into cashback_rules (service, enabled, percent, min_spend, monthly_cap) values
  ('data', true, 1, 500, 500),
  ('cable', true, 1, 1000, 500),
  ('airtime', false, 0, 0, null),
  ('electricity', false, 0, 0, null)
on conflict do nothing;

alter table transactions
  add column if not exists cashback_used   numeric(12,2) not null default 0 check (cashback_used >= 0),
  add column if not exists cashback_earned numeric(12,2) not null default 0 check (cashback_earned >= 0);
