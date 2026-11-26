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

  if (!globalThis.__vtuPostgresPool) {
    const pool = new Pool({
      connectionString: secureConnectionString(connectionString),
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      options: "-c statement_timeout=20000",
    });
    pool.on("error", (error) => {
      console.error("[db] Idle PostgreSQL client error", error);
    });
    globalThis.__vtuPostgresPool = pool;
  }
  return globalThis.__vtuPostgresPool;
}

function secureConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  }
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

export async function checkDatabaseConnection(): Promise<void> {
  await getPool().query("SELECT 1");
}
