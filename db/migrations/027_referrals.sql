alter table customers add column if not exists referral_code text;
create unique index if not exists customers_referral_code_idx on customers (referral_code);

create table if not exists referrals (
  referee_id text primary key references customers(id) on delete cascade,
  referrer_id text not null references customers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'rewarded')),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check (referee_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on referrals (referrer_id, status);

create table if not exists referral_settings (
  id text primary key default 'main' check (id = 'main'),
  enabled boolean not null default false,
  referrer_reward numeric(12,2) not null default 100 check (referrer_reward >= 0),
  referee_reward numeric(12,2) not null default 50 check (referee_reward >= 0),
  min_purchase numeric(12,2) not null default 1000 check (min_purchase >= 0),
  monthly_limit int not null default 20 check (monthly_limit >= 0)
);
insert into referral_settings (id) values ('main') on conflict do nothing;

alter table cashback_ledger drop constraint if exists cashback_ledger_source_check;
alter table cashback_ledger
  add constraint cashback_ledger_source_check check (source in ('earn', 'spend', 'restore', 'referral'));
