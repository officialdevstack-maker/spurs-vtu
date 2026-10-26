import pg from "pg";

const WALLET_URL = (process.env.SPURS_WALLET_URL || "http://localhost:3200").replace(/\/$/, "");
const SECRET = process.env.INTERNAL_API_SECRET;
if (!SECRET) throw new Error("INTERNAL_API_SECRET must be set.");

const only = process.argv[2] ?? null;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const { rows } = await pool.query(
    `select id, customer_id, amount from transactions
     where status = 'failed' and debited and not refunded
       and ($1::text is null or id = $1)
     order by created_at`,
    [only],
  );
  console.log(`${rows.length} refund(s) to retry`);

  for (const row of rows) {
    const res = await fetch(`${WALLET_URL}/api/private/wallet/credit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": SECRET },
      body: JSON.stringify({
        user: row.customer_id,
        asset: "NGN",
        amount: Math.round(Number(row.amount) * 100),
        source: "transfer_in",
        reference: `${row.id}:refund`,
        description: "Spur VTU purchase refund",
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      console.error(`FAILED ${row.id}: ${res.status} ${await res.text()}`);
      continue;
    }
    await pool.query("update transactions set refunded = true, updated_at = now() where id = $1", [row.id]);
    console.log(`refunded ${row.id}`);
  }
} finally {
  await pool.end();
}
