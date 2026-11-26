create table if not exists support_tickets (
  id              text primary key,
  customer_id     text not null references customers(id) on delete cascade,
  subject         text not null,
  transaction_id  text references transactions(id) on delete set null,
  status          text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists support_tickets_customer_idx on support_tickets (customer_id, last_message_at desc);
create index if not exists support_tickets_active_idx on support_tickets (last_message_at) where status <> 'closed';

create table if not exists support_messages (
  id         text primary key,
  ticket_id  text not null references support_tickets(id) on delete cascade,
  author_id  text references customers(id) on delete set null,
  from_staff boolean not null default false,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on support_messages (ticket_id, created_at);

insert into role_permissions (role_id, permission)
select 'support', 'support.manage' from roles where id = 'support'
on conflict do nothing;
