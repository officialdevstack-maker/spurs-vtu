alter table provider_endpoints drop constraint if exists provider_endpoints_service_check;
alter table provider_endpoints
  add constraint provider_endpoints_service_check
  check (service in (
    'airtime', 'data', 'cable', 'cable_verify', 'electricity',
    'electricity_verify', 'exam', 'balance', 'auth', 'status',
    'networks', 'data_plans'
  ));

insert into provider_endpoints (
  id, provider_id, service, method, path, body_template, response_map, active
)
values (
  'bilalsadasub-data-plans', 'bilalsadasub', 'data_plans', 'GET',
  '/api/v1/plans/data', '', '{}'::jsonb, true
)
on conflict (provider_id, service) do update
  set method = excluded.method,
      path = excluded.path,
      body_template = excluded.body_template,
      response_map = excluded.response_map,
      active = excluded.active;
