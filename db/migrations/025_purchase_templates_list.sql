alter table purchase_templates add column if not exists id text;
alter table purchase_templates add column if not exists name text not null default '';
alter table purchase_templates add column if not exists active boolean not null default true;
alter table purchase_templates add column if not exists created_at timestamptz not null default now();

update purchase_templates set id = service || '-' || status where id is null;
update purchase_templates set name = initcap(service) || ' ' || status where name = '';

alter table purchase_templates drop constraint if exists purchase_templates_pkey;
alter table purchase_templates alter column id set not null;
alter table purchase_templates add primary key (id);

create unique index if not exists purchase_templates_one_active_idx
  on purchase_templates (service, status) where active;
