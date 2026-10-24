alter table packages
  add column if not exists upgrade_fee numeric(12,2) not null default 0 check (upgrade_fee >= 0);

create table if not exists package_changes (
  id               text primary key,
  customer_id      text not null references customers(id) on delete cascade,
  from_package_id  text references packages(id) on delete set null,
  to_package_id    text references packages(id) on delete set null,
  fee              numeric(12,2) not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists package_changes_customer_idx on package_changes (customer_id, created_at desc);
