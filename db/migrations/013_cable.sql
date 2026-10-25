create table if not exists cable_operators (
  id          text primary key,
  name        text not null,
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists cable_plans (
  id                text primary key,
  operator_id       text not null references cable_operators(id) on delete cascade,
  name              text not null,
  validity          text not null,
  cost              numeric(12,2) not null check (cost >= 0),
  price             numeric(12,2) not null check (price >= 0),
  provider_id       text references providers(id) on delete set null,
  provider_plan_id  text not null default '',
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists cable_plans_operator_idx on cable_plans (operator_id);
create index if not exists cable_plans_provider_idx on cable_plans (provider_id);

create table if not exists cable_plan_package_prices (
  plan_id     text not null references cable_plans(id) on delete cascade,
  package_id  text not null references packages(id) on delete cascade,
  mode        text not null check (mode in ('fixed', 'percent')),
  value       numeric(12,2) not null check (value >= 0),
  primary key (plan_id, package_id),
  check (mode = 'fixed' or value <= 100)
);
create index if not exists cable_plan_package_prices_package_idx on cable_plan_package_prices (package_id);

insert into cable_operators (id, name, sort_order) values
  ('dstv', 'DStv', 1),
  ('gotv', 'GOtv', 2),
  ('startimes', 'StarTimes', 3)
on conflict do nothing;
