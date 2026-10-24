update data_plans
set volume = btrim(regexp_replace(size, '[[:alpha:]]+$', ''))::numeric,
    unit = lower(substring(size from '[A-Za-z]+$'))
where size ~* '^[0-9]+(\.[0-9]+)?\s*(mb|gb)$';
