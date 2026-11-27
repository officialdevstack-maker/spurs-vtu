alter table payment_providers
  drop constraint if exists payment_providers_id_check;

alter table payment_providers
  add constraint payment_providers_id_check check (id in ('flutterwave', 'paymentpoint'));

alter table payment_providers
  add column if not exists business_id_enc text;

create table if not exists paymentpoint_virtual_accounts (
  customer_id text primary key references customers(id) on delete restrict,
  account_number text unique,
  bank_name text,
  account_name text,
  reserved_account_id text,
  status text not null default 'creating' check (status in ('creating', 'active')),
  created_at timestamptz not null default now(),
  check (
    (status = 'creating' and account_number is null and bank_name is null)
    or (status = 'active' and account_number is not null and bank_name is not null)
  )
);

create table if not exists paymentpoint_payments (
  transaction_id text primary key,
  customer_id text not null references customers(id) on delete restrict,
  account_number text not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  created_at timestamptz not null default now()
);
