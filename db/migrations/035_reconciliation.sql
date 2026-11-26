alter table provider_endpoints drop constraint if exists provider_endpoints_service_check;
alter table provider_endpoints
  add constraint provider_endpoints_service_check
  check (service in ('airtime', 'data', 'cable', 'cable_verify', 'electricity', 'electricity_verify', 'exam', 'balance', 'auth', 'status'));

create table if not exists reconciliation_items (
  id             text primary key,
  transaction_id text not null references transactions(id) on delete cascade,
  kind           text not null check (kind in ('late_success', 'stuck_pending')),
  provider_id    text references providers(id) on delete set null,
  status         text not null default 'open' check (status in ('open', 'resolved')),
  resolution     text check (resolution in ('recharged', 'written_off', 'confirmed_success', 'failed_refunded')),
  note           text,
  resolved_by    text,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

create unique index if not exists reconciliation_one_open_idx
  on reconciliation_items (transaction_id) where status = 'open';
create index if not exists reconciliation_open_idx
  on reconciliation_items (created_at desc) where status = 'open';
