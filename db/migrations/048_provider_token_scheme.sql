update providers
set auth_type = 'login', auth_name = 'Token'
where id in ('bilalsadasub', 'madisync');

insert into provider_endpoints (
  id, provider_id, service, method, path, body_template, response_map, active
)
values (
  'bilalsadasub-auth', 'bilalsadasub', 'auth', 'POST', '/api/user', '',
  '{"token":"AccessToken"}'::jsonb, true
)
on conflict (provider_id, service) do update
  set method = excluded.method,
      path = excluded.path,
      body_template = excluded.body_template,
      response_map = excluded.response_map,
      active = excluded.active;

insert into provider_endpoints (
  id, provider_id, service, method, path, body_template, response_map, active
)
select
  'madisync-auth', 'madisync', 'auth', 'POST', '/api/user', '',
  '{"token":"AccessToken"}'::jsonb, true
where exists (select 1 from providers where id = 'madisync')
on conflict (provider_id, service) do update
  set method = excluded.method,
      path = excluded.path,
      body_template = excluded.body_template,
      response_map = excluded.response_map,
      active = excluded.active;
