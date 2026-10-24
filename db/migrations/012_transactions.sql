create table if not exists transactions (
  id                text primary key,
  customer_id       text not null references customers(id) on delete restrict,
  service           text not null check (service in ('airtime', 'data', 'cable', 'electricity', 'wallet')),
  title             text not null,
  detail            text not null default '',
  amount            numeric(12,2) not null check (amount >= 0),
  cost              numeric(12,2) check (cost is null or cost >= 0),
  direction         text not null default 'debit' check (direction in ('debit', 'credit')),
  status            text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  network_id        text references networks(id) on delete set null,
  plan_id           text references data_plans(id) on delete set null,
  provider_id       text references providers(id) on delete set null,
  phone             text,
  debited           boolean not null default false,
  refunded          boolean not null default false,
  failure_reason    text,
  provider_response text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists transactions_customer_idx on transactions (customer_id, created_at desc);
create index if not exists transactions_attention_idx on transactions (created_at desc) where status <> 'success';
