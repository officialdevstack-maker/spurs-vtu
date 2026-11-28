create table if not exists provider_cable_codes (
  provider_id  text not null references providers(id) on delete cascade,
  operator_id  text not null references cable_operators(id) on delete cascade,
  code         text not null,
  primary key (provider_id, operator_id)
);

insert into providers (
  id, name, kind, base_url, auth_type, auth_name, auth_username,
  secret_enc, enabled, priority, timeout_ms
)
values (
  'bilalsadasub', 'Bilalsadasub', 'api', 'https://bilalsadasub.com',
  'api_key_header', 'Authorization', '', null, false, 50, 15000
)
on conflict (id) do nothing;

insert into provider_endpoints (
  id, provider_id, service, method, path, body_template, response_map, active
)
values
  (
    'bilalsadasub-airtime', 'bilalsadasub', 'airtime', 'POST', '/api/topup',
    '{"network": {network}, "phone": {phone}, "plan_type": {type}, "amount": {amount}, "request-id": {reference}}',
    '{"status":"status"}'::jsonb, true
  ),
  (
    'bilalsadasub-data', 'bilalsadasub', 'data', 'POST', '/api/data',
    '{"network": {network}, "phone": {phone}, "data_plan": {plan}, "request-id": {reference}}',
    '{"status":"status"}'::jsonb, true
  ),
  (
    'bilalsadasub-cable', 'bilalsadasub', 'cable', 'POST', '/api/cable',
    '{"cable": {operator}, "cable_plan": {plan}, "iuc": {smartcard}, "bypass": 0, "request-id": {reference}}',
    '{"status":"status"}'::jsonb, true
  )
on conflict (provider_id, service) do nothing;

update provider_endpoints
set body_template = case service
  when 'airtime' then
    '{"network": {network}, "phone": {phone}, "plan_type": {type}, "amount": {amount}, "request-id": {reference}}'
  when 'data' then
    '{"network": {network}, "phone": {phone}, "data_plan": {plan}, "request-id": {reference}}'
  when 'cable' then
    '{"cable": {operator}, "cable_plan": {plan}, "iuc": {smartcard}, "bypass": 0, "request-id": {reference}}'
  end
where provider_id = 'madisync'
  and service in ('airtime', 'data', 'cable');
