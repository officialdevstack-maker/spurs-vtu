alter table data_plans
  add column if not exists volume numeric(10,2) check (volume is null or volume > 0),
  add column if not exists unit text check (unit is null or unit in ('mb', 'gb')),
  add column if not exists provider_id text references providers(id) on delete set null,
  add column if not exists provider_plan_id text not null default '';

update data_plans
set volume = btrim(regexp_replace(size, '[[:alpha:]]+$', ''))::numeric,
    unit = lower(substring(size from '[A-Za-z]+$'))
where size ~* '^[0-9]+(\.[0-9]+)?\s*(mb|gb)$';

create index if not exists data_plans_provider_idx on data_plans (provider_id);
