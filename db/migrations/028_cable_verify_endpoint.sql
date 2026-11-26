alter table provider_endpoints drop constraint if exists provider_endpoints_service_check;
alter table provider_endpoints
  add constraint provider_endpoints_service_check
  check (service in ('airtime', 'data', 'cable', 'cable_verify', 'electricity', 'exam', 'balance'));
