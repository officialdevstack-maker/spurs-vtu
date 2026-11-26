create table if not exists admin_audit_log (
  id          text primary key,
  actor_id    text,
  actor_label text not null,
  action      text not null,
  target      text,
  summary     text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on admin_audit_log (created_at desc, id);
create index if not exists admin_audit_log_actor_idx on admin_audit_log (actor_id, created_at desc);
create index if not exists admin_audit_log_action_idx on admin_audit_log (action, created_at desc);

create or replace function admin_audit_log_immutable() returns trigger as $$
begin
  raise exception 'admin_audit_log is append-only';
end;
$$ language plpgsql;

drop trigger if exists admin_audit_log_no_change on admin_audit_log;
create trigger admin_audit_log_no_change
  before update or delete on admin_audit_log
  for each row execute function admin_audit_log_immutable();
