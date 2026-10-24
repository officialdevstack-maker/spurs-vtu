alter table data_types
  add column if not exists service text not null default 'data' check (service in ('airtime', 'data'));

create table if not exists airtime_discounts (
  id          text primary key,
  network_id  text not null references networks(id) on delete cascade,
  type_id     text not null references data_types(id) on delete restrict,
  discount    numeric(5,2) not null check (discount between 0 and 100),
  min_amount  numeric(12,2) not null check (min_amount >= 0),
  max_amount  numeric(12,2) not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (max_amount >= min_amount)
);
create index if not exists airtime_discounts_network_idx on airtime_discounts (network_id, type_id);

insert into data_types (id, label, service) values
  ('airtime-vtu', 'VTU', 'airtime'),
  ('airtime-share', 'Share & Sell', 'airtime')
on conflict do nothing;

insert into network_data_types (network_id, type_id)
select n.id, t.id from networks n cross join data_types t where t.service = 'airtime'
on conflict do nothing;

insert into airtime_discounts (id, network_id, type_id, discount, min_amount, max_amount)
select 'dsc-' || id, id, 'airtime-vtu', airtime_discount, 50, 100000 from networks
on conflict do nothing;
