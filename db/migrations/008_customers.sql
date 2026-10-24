create table if not exists customers (
  id text primary key,
  name text,
  username text,
  email text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists customers_created_at_idx on customers (created_at desc);
create index if not exists customers_status_created_at_idx on customers (status, created_at desc);
