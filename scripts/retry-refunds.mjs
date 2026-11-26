import pg from "pg";

const only = process.argv[2] ?? null;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const { rows } = await pool.query(
    `select id, customer_id, amount, cashback_used from transactions
     where status = 'failed' and debited and not refunded
       and ($1::text is null or id = $1)
     order by created_at`,
    [only],
  );
  console.log(`${rows.length} refund(s) to retry`);

  for (const row of rows) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const current = await client.query(
        `select customer_id, amount, cashback_used, debited, refunded, status
         from transactions where id = $1 for update`,
        [row.id],
      );
      const tx = current.rows[0];
      if (!tx || tx.status !== "failed" || !tx.debited || tx.refunded) {
        await client.query("rollback");
        continue;
      }

      const walletAmount = Math.round((Number(tx.amount) - Number(tx.cashback_used ?? 0)) * 100) / 100;
      const walletAmountKobo = Math.round(walletAmount * 100);
      const cashbackAmountKobo = Math.round(Number(tx.cashback_used ?? 0) * 100);
      const reference = `${row.id}:refund`;
      if (walletAmountKobo > 0) {
        await client.query(
          `insert into vtu_wallets (customer_id) values ($1)
           on conflict (customer_id) do nothing`,
          [tx.customer_id],
        );
        await client.query("select customer_id from vtu_wallets where customer_id = $1 for update", [tx.customer_id]);
        const previous = await client.query(
          `select customer_id, amount_kobo, direction from vtu_wallet_ledger
           where reference = $1`,
          [reference],
        );
        if (previous.rows[0]) {
          const entry = previous.rows[0];
          if (
            entry.customer_id !== tx.customer_id ||
            entry.direction !== "credit" ||
            Number(entry.amount_kobo) !== walletAmountKobo
          ) {
            throw new Error(`Refund reference conflicts with wallet ledger for ${row.id}`);
          }
        } else {
          await client.query(
            `insert into vtu_wallet_ledger (reference, customer_id, direction, amount_kobo, source)
             values ($1, $2, 'credit', $3, 'refund')`,
            [reference, tx.customer_id, walletAmountKobo],
          );
          await client.query(
            `update vtu_wallets set balance_kobo = balance_kobo + $2, updated_at = now()
             where customer_id = $1`,
            [tx.customer_id, walletAmountKobo],
          );
        }
      }
      if (cashbackAmountKobo > 0) {
        await client.query(
          `insert into cashback_wallets (customer_id) values ($1)
           on conflict (customer_id) do nothing`,
          [tx.customer_id],
        );
        await client.query(
          "select customer_id from cashback_wallets where customer_id = $1 for update",
          [tx.customer_id],
        );
        const cashbackReference = `${row.id}:refund-cb`;
        const previousCashback = await client.query(
          `select customer_id, amount_kobo, direction from cashback_ledger
           where reference = $1`,
          [cashbackReference],
        );
        if (previousCashback.rows[0]) {
          const entry = previousCashback.rows[0];
          if (
            entry.customer_id !== tx.customer_id ||
            entry.direction !== "credit" ||
            Number(entry.amount_kobo) !== cashbackAmountKobo
          ) {
            throw new Error(`Refund cashback reference conflicts with ledger for ${row.id}`);
          }
        } else {
          await client.query(
            `insert into cashback_ledger
               (reference, customer_id, direction, amount_kobo, source)
             values ($1, $2, 'credit', $3, 'restore')`,
            [cashbackReference, tx.customer_id, cashbackAmountKobo],
          );
          await client.query(
            `update cashback_wallets set balance_kobo = balance_kobo + $2, updated_at = now()
             where customer_id = $1`,
            [tx.customer_id, cashbackAmountKobo],
          );
        }
      }
      await client.query("update transactions set refunded = true, updated_at = now() where id = $1", [row.id]);
      await client.query("commit");
      console.log(`refunded ${row.id}`);
    } catch (error) {
      await client.query("rollback");
      console.error(`FAILED ${row.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
