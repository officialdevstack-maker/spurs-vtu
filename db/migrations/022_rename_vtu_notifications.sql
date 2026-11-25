do $$
begin
  if to_regclass(format('%I.%I', current_schema(), 'vtu_notifications')) is null
     and exists (
       select 1
         from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'notifications'
          and column_name in ('customer_id', 'broadcast_id', 'read_at')
        group by table_schema, table_name
       having count(distinct column_name) = 3
     ) then
    execute format('alter table %I.%I rename to %I', current_schema(), 'notifications', 'vtu_notifications');
  end if;
end $$;
