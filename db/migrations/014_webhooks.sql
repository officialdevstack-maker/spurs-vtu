alter table providers add column if not exists webhook_token text;

update providers
set webhook_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where webhook_token is null;

alter table providers
  alter column webhook_token set default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  alter column webhook_token set not null;

create unique index if not exists providers_webhook_token_idx on providers (webhook_token);

create table if not exists app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

create table if not exists provider_webhook_events (
  id           text primary key,
  provider_id  text references providers(id) on delete cascade,
  reference    text,
  outcome      text not null check (outcome in ('success', 'failed', 'pending')),
  result       text not null check (result in ('applied', 'ignored', 'not_found', 'already_settled', 'late_success')),
  payload      text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists provider_webhook_events_created_idx on provider_webhook_events (created_at desc);
create index if not exists provider_webhook_events_provider_idx on provider_webhook_events (provider_id, created_at desc);
