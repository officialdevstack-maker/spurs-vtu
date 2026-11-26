create table if not exists plan_provider_codes (
  service          text not null check (service in ('data', 'cable')),
  plan_id          text not null,
  provider_id      text not null references providers(id) on delete cascade,
  provider_plan_id text not null,
  cost             numeric(12,2) not null check (cost >= 0),
  primary key (service, plan_id, provider_id)
);

create table if not exists transaction_attempts (
  id             text primary key,
  transaction_id text not null references transactions(id) on delete cascade,
  attempt        int not null,
  provider_id    text references providers(id) on delete set null,
  outcome        text not null check (outcome in ('success', 'failed', 'pending', 'not_sent')),
  http_status    int,
  created_at     timestamptz not null default now(),
  unique (transaction_id, attempt)
);
create index if not exists transaction_attempts_provider_idx on transaction_attempts (provider_id, created_at desc);
