import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

declare global {
  var __vtuPostgresPool: Pool | undefined;
  var __vtuDrizzleDb: ReturnType<typeof drizzle> | undefined;
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set before connecting to PostgreSQL.");
  }

  return (globalThis.__vtuPostgresPool ??= new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  }));
}

export function getDb() {
  return (globalThis.__vtuDrizzleDb ??= drizzle(getPool()));
}

export async function checkDatabaseConnection(): Promise<void> {
  await getPool().query("SELECT 1");
}
