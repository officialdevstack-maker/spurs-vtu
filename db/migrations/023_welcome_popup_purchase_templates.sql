create table if not exists welcome_popup (
  id text primary key default 'welcome' check (id = 'welcome'),
  enabled boolean not null default true,
  title text not null default '',
  body text not null default '',
  cta_label text not null default '',
  cta_href text not null default '',
  version int not null default 1,
  updated_at timestamptz not null default now()
);

insert into welcome_popup (id, enabled, title, body, cta_label, cta_href) values
  ('welcome', true, 'Welcome to Spur VTU, {name}!',
   'Fund your wallet once, then buy airtime, data, cable TV and electricity in a few taps.',
   'Fund wallet', '/fund-wallet')
on conflict do nothing;

alter table customers add column if not exists welcome_seen_version int not null default 0;

create table if not exists purchase_templates (
  service text not null check (service in ('airtime', 'data', 'cable', 'electricity')),
  status text not null check (status in ('success', 'pending', 'failed')),
  message text not null,
  updated_at timestamptz not null default now(),
  primary key (service, status)
);
