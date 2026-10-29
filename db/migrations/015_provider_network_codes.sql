create table if not exists provider_network_codes (
  provider_id  text not null references providers(id) on delete cascade,
  network_id   text not null references networks(id) on delete cascade,
  code         text not null,
  primary key (provider_id, network_id)
);

create index if not exists provider_network_codes_network_idx on provider_network_codes (network_id);
