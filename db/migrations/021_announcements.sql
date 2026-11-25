create table if not exists welcome_templates (
  channel text primary key check (channel in ('system', 'email', 'sms', 'push')),
  enabled boolean not null default false,
  subject text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now()
);

insert into welcome_templates (channel, enabled, subject, body) values
  ('system', true, 'Welcome to Spur VTU', 'Hi {name}, your account is ready. Fund your wallet to buy airtime, data, cable TV and electricity in seconds.'),
  ('email', false, 'Welcome to Spur VTU', E'Hi {name},\n\nYour Spur VTU account is ready. Fund your wallet once, then buy airtime, data, cable TV and electricity in a few taps.\n\nThe Spur VTU team'),
  ('sms', false, '', 'Welcome to Spur VTU, {name}! Fund your wallet to start buying airtime and data.'),
  ('push', false, 'Welcome to Spur VTU', 'Your account is ready. Tap to fund your wallet.')
on conflict do nothing;

alter table customers add column if not exists welcome_sent_at timestamptz;
update customers set welcome_sent_at = now() where welcome_sent_at is null;

create table if not exists broadcasts (
  id text primary key,
  title text not null,
  body text not null,
  channels text[] not null,
  audience text not null check (audience in ('all', 'package', 'staff')),
  package_id text references packages(id) on delete set null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  total int not null default 0,
  processed int not null default 0,
  results jsonb not null default '{}'::jsonb,
  cursor text,
  locked_until timestamptz,
  created_by text references customers(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists broadcasts_created_idx on broadcasts (created_at desc);
create index if not exists broadcasts_sending_idx on broadcasts (created_at) where status = 'sending';

create table if not exists notifications (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  title text not null,
  body text not null,
  broadcast_id text references broadcasts(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_customer_idx on notifications (customer_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (customer_id) where read_at is null;
