alter table airtime_discounts
  add column if not exists provider_id text references providers(id) on delete set null,
  add column if not exists provider_discount numeric(5,2)
    check (provider_discount is null or provider_discount between 0 and 100);

create index if not exists airtime_discounts_provider_idx on airtime_discounts (provider_id);
