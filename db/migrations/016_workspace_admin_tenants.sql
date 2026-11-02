CREATE OR REPLACE FUNCTION pg_temp.add_workspace_scope(table_name text) RETURNS void AS $$
BEGIN
  EXECUTE format(
    'ALTER TABLE %I ADD COLUMN IF NOT EXISTS workspace_id uuid NOT NULL DEFAULT %L::uuid',
    table_name,
    '00000000-0000-0000-0000-000000000001'
  );
END;
$$ LANGUAGE plpgsql;

SELECT pg_temp.add_workspace_scope('networks');
SELECT pg_temp.add_workspace_scope('providers');
SELECT pg_temp.add_workspace_scope('packages');
SELECT pg_temp.add_workspace_scope('cable_operators');
SELECT pg_temp.add_workspace_scope('transactions');

ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_name_key;
DROP INDEX IF EXISTS packages_one_default_idx;
CREATE UNIQUE INDEX IF NOT EXISTS packages_workspace_name_idx
  ON packages (workspace_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS packages_workspace_one_default_idx
  ON packages (workspace_id) WHERE is_default;
CREATE UNIQUE INDEX IF NOT EXISTS networks_workspace_name_idx
  ON networks (workspace_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS providers_workspace_name_idx
  ON providers (workspace_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS cable_operators_workspace_name_idx
  ON cable_operators (workspace_id, lower(name));

CREATE INDEX IF NOT EXISTS transactions_workspace_created_idx
  ON transactions (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customers_workspace_search_idx
  ON customers (status, created_at DESC);
CREATE INDEX IF NOT EXISTS network_data_types_network_idx
  ON network_data_types (network_id, type_id);

CREATE TABLE IF NOT EXISTS workspace_customers (
  workspace_id uuid NOT NULL,
  customer_id text,
  package_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_customers
  ADD COLUMN IF NOT EXISTS package_id text REFERENCES packages(id) ON DELETE SET NULL;

ALTER TABLE workspace_customers
  ADD COLUMN IF NOT EXISTS customer_id text;
ALTER TABLE workspace_customers
  DROP CONSTRAINT IF EXISTS workspace_customers_workspace_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'workspace_customers'
       AND column_name = 'user_id'
  ) THEN
    EXECUTE $query$
      INSERT INTO customers (id, name, email, status, created_at, last_seen_at)
      SELECT user_id, name, email, status, created_at, last_seen_at
        FROM workspace_customers
      ON CONFLICT (id) DO NOTHING
    $query$;
    EXECUTE 'UPDATE workspace_customers SET customer_id = user_id WHERE customer_id IS NULL';
    ALTER TABLE workspace_customers DROP COLUMN user_id;
    ALTER TABLE workspace_customers DROP COLUMN name;
    ALTER TABLE workspace_customers DROP COLUMN email;
  END IF;
END $$;

ALTER TABLE workspace_customers
  ALTER COLUMN customer_id SET NOT NULL;

ALTER TABLE workspace_customers
  DROP CONSTRAINT IF EXISTS workspace_customers_pkey;
ALTER TABLE workspace_customers
  ADD CONSTRAINT workspace_customers_pkey PRIMARY KEY (workspace_id, customer_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'workspace_customers'::regclass
       AND conname = 'workspace_customers_customer_id_fkey'
  ) THEN
    ALTER TABLE workspace_customers
      ADD CONSTRAINT workspace_customers_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'workspace_customers'::regclass
       AND conname = 'workspace_customers_package_id_fkey'
  ) THEN
    ALTER TABLE workspace_customers
      ADD CONSTRAINT workspace_customers_package_id_fkey
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO workspace_customers (workspace_id, customer_id, package_id, status, created_at, last_seen_at)
SELECT '00000000-0000-0000-0000-000000000001'::uuid,
       c.id,
       c.package_id,
       c.status,
       c.created_at,
       c.last_seen_at
  FROM customers c
ON CONFLICT (workspace_id, customer_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS workspace_customers_workspace_created_idx
  ON workspace_customers (workspace_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS workspace_customers_customer_idx
  ON workspace_customers (customer_id);
