// Usage: node --env-file=.env scripts/grant-owner.mjs <spurs-id | email | username | phone> [--revoke]
import pg from "pg";

const TENANT = "00000000-0000-0000-0000-000000000001";
const [, , identifier, flag] = process.argv;

if (!identifier) {
  console.error("Usage: node --env-file=.env scripts/grant-owner.mjs <spurs-id | email | username | phone> [--revoke]");
  process.exit(1);
}

const revoke = flag === "--revoke";
const typed = identifier.trim();
const key = typed.replace(/^@/, "").toLowerCase();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const { rows } = await pool.query(
    `select c.id, c.name, c.username, c.email
       from customers c
       join workspace_customers wc on wc.customer_id = c.id and wc.workspace_id = $3
      where lower(c.username) = $1 or lower(c.email) = $1 or c.phone = $2 or c.id = $2`,
    [key, typed, TENANT],
  );

  if (rows.length === 0) throw new Error("No customer found. They need to log in to Spur VTU once first.");
  if (rows.length > 1) throw new Error("More than one customer matched. Use the exact Spurs ID instead.");
  const customer = rows[0];
  const label = customer.username || customer.email || customer.id;

  if (revoke) {
    const owners = await pool.query("select count(*)::int as n from staff_members where role_id = 'owner'");
    if (owners.rows[0].n <= 1) throw new Error("That would leave no owners. Grant someone else first.");
    const result = await pool.query(
      "delete from staff_members where customer_id = $1 and role_id = 'owner'",
      [customer.id],
    );
    console.log(result.rowCount ? `Revoked owner from ${label}` : `${label} is not an owner`);
  } else {
    await pool.query(
      `insert into staff_members (customer_id, role_id) values ($1, 'owner')
       on conflict (customer_id) do update set role_id = 'owner'`,
      [customer.id],
    );
    console.log(`${label} is now an owner`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
