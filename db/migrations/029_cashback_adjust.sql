alter table cashback_ledger drop constraint if exists cashback_ledger_source_check;
alter table cashback_ledger
  add constraint cashback_ledger_source_check
  check (source in ('earn', 'spend', 'restore', 'referral', 'adjust'));

alter table cashback_ledger
  add column if not exists note text,
  add column if not exists created_by text;
