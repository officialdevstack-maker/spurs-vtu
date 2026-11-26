create table if not exists customer_pins (
  customer_id text primary key references customers(id) on delete cascade,
  pin_hash text,
  required boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists pin_reset_tokens (
  token_hash text primary key,
  customer_id text not null references customers(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pin_reset_tokens_customer_idx
  on pin_reset_tokens (customer_id, created_at desc);
