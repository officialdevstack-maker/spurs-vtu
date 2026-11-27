alter table payment_providers
  add column if not exists deposit_fee_type text not null default 'flat'
    check (deposit_fee_type in ('flat', 'percentage')),
  add column if not exists deposit_fee_value numeric(12,2) not null default 0
    check (deposit_fee_value >= 0),
  add column if not exists minimum_deposit_kobo bigint not null default 10000
    check (minimum_deposit_kobo between 10000 and 100000000);

alter table flutterwave_payments
  add column if not exists deposit_fee_kobo bigint not null default 0
    check (deposit_fee_kobo >= 0),
  add column if not exists review_required boolean not null default false;

alter table paymentpoint_payments
  add column if not exists deposit_fee_kobo bigint not null default 0
    check (deposit_fee_kobo >= 0),
  add column if not exists review_required boolean not null default false;

alter table flutterwave_funding_intents
  drop constraint if exists flutterwave_funding_intents_status_check;

alter table flutterwave_funding_intents
  add constraint flutterwave_funding_intents_status_check
    check (status in ('creating', 'pending', 'completed', 'failed', 'review'));

alter table paymentpoint_funding_intents
  drop constraint if exists paymentpoint_funding_intents_status_check;

alter table paymentpoint_funding_intents
  add constraint paymentpoint_funding_intents_status_check
    check (status in ('creating', 'pending', 'completed', 'failed', 'review'));
