create table if not exists promo_codes (
  id                 text primary key,
  code               text not null,
  description        text not null default '',
  kind               text not null check (kind in ('percent', 'fixed')),
  value              numeric(12,2) not null check (value > 0),
  max_discount       numeric(12,2) check (max_discount is null or max_discount > 0),
  min_spend          numeric(12,2) not null default 0 check (min_spend >= 0),
  services           text[] not null default '{}',
  total_limit        int check (total_limit is null or total_limit > 0),
  per_customer_limit int not null default 1 check (per_customer_limit > 0),
  starts_at          timestamptz,
  expires_at         timestamptz,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  check (kind = 'fixed' or value <= 100),
  check (starts_at is null or expires_at is null or expires_at > starts_at)
);
create unique index if not exists promo_codes_code_idx on promo_codes (upper(code));

create table if not exists promo_redemptions (
  transaction_id text primary key references transactions(id) on delete cascade,
  promo_id       text not null references promo_codes(id) on delete restrict,
  customer_id    text not null references customers(id) on delete cascade,
  discount       numeric(12,2) not null check (discount > 0),
  created_at     timestamptz not null default now()
);
create index if not exists promo_redemptions_promo_idx on promo_redemptions (promo_id);
create index if not exists promo_redemptions_customer_idx on promo_redemptions (customer_id, promo_id);
