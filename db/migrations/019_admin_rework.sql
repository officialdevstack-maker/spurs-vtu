alter table roles add column if not exists is_owner boolean not null default false;

insert into roles (id, name, description, is_owner) values
  ('owner', 'Owner', 'Full access to everything. Granted with scripts/grant-owner.mjs only.', true)
on conflict (id) do update set is_owner = true;

create unique index if not exists roles_one_owner_idx on roles (is_owner) where is_owner;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = current_schema() and table_name = 'staff_members' and column_name = 'id'
  ) then
    alter table staff_members rename column id to customer_id;
  end if;
end $$;

delete from staff_members where customer_id not in (select id from customers);

alter table staff_members drop column if exists name;
alter table staff_members drop column if exists username;
alter table staff_members drop column if exists email;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'staff_members'::regclass and conname = 'staff_members_customer_id_fkey'
  ) then
    alter table staff_members
      add constraint staff_members_customer_id_fkey
      foreign key (customer_id) references customers(id) on delete cascade;
  end if;
end $$;

insert into workspace_customers (workspace_id, customer_id, package_id, status, created_at, last_seen_at)
select '00000000-0000-0000-0000-000000000001'::uuid, c.id, c.package_id, c.status, c.created_at, c.last_seen_at
  from customers c
 where not exists (select 1 from workspace_customers w where w.customer_id = c.id)
on conflict (workspace_id, customer_id) do nothing;

create index if not exists workspace_customers_status_idx
  on workspace_customers (workspace_id, status, created_at desc);
