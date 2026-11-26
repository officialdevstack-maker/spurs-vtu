import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const table of ["api_rate_limits", "api_webhooks", "api_webhook_deliveries"]) {
    const result = await pool.query(
      "select column_name,data_type,is_nullable from information_schema.columns where table_name=$1 order by ordinal_position",
      [table],
    );
    console.log(table, JSON.stringify(result.rows));
  }
  const migrations = await pool.query("select name,applied_at from schema_migrations order by name desc limit 10");
  console.log("migrations", JSON.stringify(migrations.rows));
  const apiTables = await pool.query(
    "select table_name,column_name,data_type,is_nullable from information_schema.columns where table_name like 'api_%' order by table_name,ordinal_position",
  );
  console.log("api tables", JSON.stringify(apiTables.rows));
  const details = await pool.query(
    `select c.relname as table_name, p.relname as dependent_table, d.deptype
     from pg_depend d
     join pg_class c on c.oid=d.refobjid
     join pg_class p on p.oid=d.objid
     where c.relname='api_keys' limit 20`,
  );
  console.log("dependencies", JSON.stringify(details.rows));
  const constraints = await pool.query(
    `select conname,pg_get_constraintdef(oid) as definition
     from pg_constraint where conrelid='api_keys'::regclass`,
  );
  console.log("constraints", JSON.stringify(constraints.rows));
} finally {
  await pool.end();
}
