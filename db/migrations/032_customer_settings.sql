create table if not exists customer_settings (
  customer_id          text primary key references customers(id) on delete cascade,
  notify_email         boolean not null default true,
  notify_sms           boolean not null default true,
  notify_push          boolean not null default true,
  notify_transactions  boolean not null default true,
  notify_promotions    boolean not null default true,
  login_alerts         boolean not null default true,
  use_cashback_default boolean not null default false,
  confirm_purchases    boolean not null default true,
  theme                text not null default 'system' check (theme in ('light', 'dark', 'system')),
  updated_at           timestamptz not null default now()
);
