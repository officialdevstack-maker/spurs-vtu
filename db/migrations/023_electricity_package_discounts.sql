create table if not exists electricity_disco_package_discounts (
  disco_id    text not null references electricity_discos(id) on delete cascade,
  package_id  text not null references packages(id) on delete cascade,
  discount    numeric(5,2) not null check (discount between 0 and 100),
  primary key (disco_id, package_id)
);

create index if not exists electricity_disco_package_discounts_package_idx
  on electricity_disco_package_discounts (package_id);
