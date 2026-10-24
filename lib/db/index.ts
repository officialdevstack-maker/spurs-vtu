import "server-only";
import { Pool } from "pg";

declare global {
  var __vtuPostgresPool: Pool | undefined;
}

export function getPool(): Pool {
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

export async function checkDatabaseConnection(): Promise<void> {
  await getPool().query("SELECT 1");
}
