create table if not exists data_types (
  id          text primary key,
  label       text not null,
  created_at  timestamptz not null default now()
);

create table if not exists networks (
  id                text primary key,
  name              text not null,
  enabled           boolean not null default true,
  airtime_discount  numeric(5,2) not null default 0 check (airtime_discount between 0 and 100),
  sort_order        int not null default 0,
  created_at        timestamptz not null default now()
);

create table if not exists network_data_types (
  network_id  text not null references networks(id) on delete cascade,
  type_id     text not null references data_types(id) on delete cascade,
  enabled     boolean not null default true,
  primary key (network_id, type_id)
);

create table if not exists data_plans (
  id          text primary key,
  network_id  text not null references networks(id) on delete cascade,
  type_id     text not null references data_types(id) on delete restrict,
  size        text not null,
  validity    text not null,
  cost        numeric(12,2) not null check (cost >= 0),
  price       numeric(12,2) not null check (price >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists data_plans_network_idx on data_plans (network_id);

create table if not exists pin_stock (
  id          text primary key,
  network_id  text not null references networks(id) on delete cascade,
  kind        text not null check (kind in ('airtime', 'data')),
  label       text not null,
  price       numeric(12,2) not null,
  available   int not null default 0,
  used        int not null default 0
);
create index if not exists pin_stock_network_idx on pin_stock (network_id, kind);
