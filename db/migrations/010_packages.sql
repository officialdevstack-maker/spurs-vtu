create table if not exists packages (
  id           text primary key,
  name         text not null unique,
  description  text not null default '',
  sort_order   int not null default 0,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

create unique index if not exists packages_one_default_idx on packages (is_default) where is_default;

insert into packages (id, name, description, sort_order, is_default) values
  ('basic', 'Basic', 'Standard rates on every service.', 1, true),
  ('api',   'API',   'For developers and resellers who buy through the API.', 2, false),
  ('agent', 'Agent', 'Lower rates for agents.', 3, false)
on conflict do nothing;

alter table customers
  add column if not exists package_id text not null default 'basic' references packages(id) on delete restrict;
create index if not exists customers_package_idx on customers (package_id);

drop table if exists data_plan_role_prices;

create table if not exists data_plan_package_prices (
  plan_id     text not null references data_plans(id) on delete cascade,
  package_id  text not null references packages(id) on delete cascade,
  mode        text not null check (mode in ('fixed', 'percent')),
  value       numeric(12,2) not null check (value >= 0),
  primary key (plan_id, package_id),
  check (mode = 'fixed' or value <= 100)
);
create index if not exists data_plan_package_prices_package_idx on data_plan_package_prices (package_id);
