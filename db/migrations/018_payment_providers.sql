create table if not exists payment_providers (
  id text primary key check (id = 'flutterwave'),
  name text not null,
  public_key_enc text not null,
  secret_key_enc text not null,
  webhook_hash_enc text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
