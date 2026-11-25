create table if not exists vtu_wallets (
  customer_id text primary key references customers(id) on delete restrict,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists vtu_wallet_ledger (
  reference text primary key,
  customer_id text not null references customers(id) on delete restrict,
  direction text not null check (direction in ('debit', 'credit')),
  amount_kobo bigint not null check (amount_kobo > 0),
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists vtu_wallet_ledger_customer_created_idx
  on vtu_wallet_ledger (customer_id, created_at desc);

create table if not exists flutterwave_virtual_accounts (
  customer_id text primary key references customers(id) on delete restrict,
  tx_ref text not null unique,
  account_number text unique,
  bank_name text,
  account_name text,
  status text not null default 'creating' check (status in ('creating', 'active')),
  created_at timestamptz not null default now()
);

create table if not exists flutterwave_funding_intents (
  reference text primary key,
  customer_id text not null references customers(id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  account_number text,
  bank_name text,
  status text not null default 'creating' check (status in ('creating', 'pending', 'completed', 'failed')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flutterwave_funding_intents_customer_created_idx
  on flutterwave_funding_intents (customer_id, created_at desc);

create table if not exists flutterwave_payments (
  transaction_id text primary key,
  reference text not null,
  customer_id text not null references customers(id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  created_at timestamptz not null default now()
);
