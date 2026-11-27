create table if not exists paymentpoint_funding_intents (
  reference text primary key,
  customer_id text not null references customers(id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  account_number text unique,
  bank_name text,
  status text not null default 'creating'
    check (status in ('creating', 'pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status in ('creating', 'failed') and account_number is null and bank_name is null)
    or (status in ('pending', 'completed') and account_number is not null and bank_name is not null)
  )
);

create index if not exists paymentpoint_funding_intents_customer_created_idx
  on paymentpoint_funding_intents (customer_id, created_at desc);
