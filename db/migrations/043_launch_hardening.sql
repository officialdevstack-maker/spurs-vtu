insert into app_settings (key, value)
values ('pending_auto_fail_minutes', '45')
on conflict (key) do nothing;

create index if not exists transactions_customer_created_idx
  on transactions (customer_id, created_at desc);
create index if not exists transactions_direction_created_idx
  on transactions (direction, created_at desc);
create index if not exists transactions_status_created_idx
  on transactions (status, created_at desc);
create index if not exists transactions_pending_created_idx
  on transactions (created_at)
  where status = 'pending';
create index if not exists support_tickets_customer_status_idx
  on support_tickets (customer_id, status, last_message_at desc);

alter table customers add column if not exists deletion_requested_at timestamptz;
alter table customers add column if not exists deleted_at timestamptz;

update flutterwave_funding_intents
set status = 'failed', updated_at = now()
where status in ('creating', 'pending')
  and ((expires_at is not null and expires_at < now())
       or (expires_at is null and created_at < now() - interval '24 hours'));

