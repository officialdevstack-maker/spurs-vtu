alter table customers add column if not exists phone text;

create table if not exists roles (
  id text primary key,
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id text not null references roles(id) on delete cascade,
  permission text not null,
  primary key (role_id, permission)
);

create table if not exists staff_members (
  id text primary key,
  name text not null default '',
  username text,
  email text,
  role_id text not null references roles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists staff_members_role_idx on staff_members (role_id);

insert into roles (id, name, description) values
  ('support', 'Support', 'Helps customers and reviews transactions.'),
  ('finance', 'Finance', 'Reviews transactions and customers.'),
  ('catalog', 'Catalog manager', 'Manages networks, plans and discounts.')
on conflict do nothing;

insert into role_permissions (role_id, permission) values
  ('support', 'customers.view'),
  ('support', 'customers.manage'),
  ('support', 'transactions.view'),
  ('finance', 'customers.view'),
  ('finance', 'transactions.view'),
  ('catalog', 'products.view'),
  ('catalog', 'products.manage')
on conflict do nothing;
