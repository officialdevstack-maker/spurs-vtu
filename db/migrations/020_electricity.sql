create table if not exists electricity_discos (
  id                text primary key,
  name              text not null,
  provider_code     text not null default '',
  enabled           boolean not null default true,
  discount          numeric(5,2) not null default 0 check (discount between 0 and 100),
  provider_id       text references providers(id) on delete set null,
  provider_discount numeric(5,2) check (provider_discount is null or provider_discount between 0 and 100),
  min_amount        numeric(12,2) not null default 500 check (min_amount >= 0),
  max_amount        numeric(12,2) not null default 100000,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  check (max_amount >= min_amount)
);

create index if not exists electricity_discos_provider_idx on electricity_discos (provider_id);

insert into electricity_discos (id, name, sort_order) values
  ('ikeja-electric', 'Ikeja Electric', 1),
  ('eko-electric', 'Eko Electric', 2),
  ('abuja-electric', 'Abuja Electric', 3),
  ('ibadan-electric', 'Ibadan Electric', 4),
  ('kano-electric', 'Kano Electric', 5),
  ('enugu-electric', 'Enugu Electric', 6),
  ('portharcourt-electric', 'Port Harcourt Electric', 7),
  ('kaduna-electric', 'Kaduna Electric', 8),
  ('jos-electric', 'Jos Electric', 9),
  ('benin-electric', 'Benin Electric', 10),
  ('yola-electric', 'Yola Electric', 11),
  ('aba-power', 'Aba Power', 12)
on conflict do nothing;
