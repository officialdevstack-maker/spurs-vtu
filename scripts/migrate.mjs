import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const dir = path.join(process.cwd(), "db", "migrations");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set((await pool.query("select name from schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (done.has(file)) continue;
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(await readFile(path.join(dir, file), "utf8"));
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }
  console.log("migrations up to date");
} finally {
  await pool.end();
}
