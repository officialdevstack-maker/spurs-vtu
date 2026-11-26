create table if not exists provider_balance (
  provider_id          text primary key references providers(id) on delete cascade,
  threshold            numeric(14,2) check (threshold is null or threshold >= 0),
  balance              numeric(14,2),
  state                text not null default 'unknown' check (state in ('unknown', 'ok', 'low', 'error')),
  consecutive_failures int not null default 0,
  last_error           text,
  checked_at           timestamptz,
  last_alerted_at      timestamptz,
  alerted_state        text,
  updated_at           timestamptz not null default now()
);
