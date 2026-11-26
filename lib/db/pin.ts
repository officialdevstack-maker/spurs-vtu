import "server-only";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getPool } from "@/lib/db";
import { LOCK_MINUTES, MAX_ATTEMPTS, PIN_PATTERN, type PinResult } from "@/lib/pin";

const scryptAsync = promisify(scrypt) as unknown as (key: Buffer, salt: Buffer, length: number) => Promise<Buffer>;

function pepper(): string {
  const value = process.env.PIN_PEPPER;
  if (!value || value.length < 32) throw new Error("PIN_PEPPER must be set to at least 32 characters.");
  return value;
}

async function derive(pin: string, salt: Buffer): Promise<Buffer> {
  const keyed = createHmac("sha256", pepper()).update(pin).digest();
  return scryptAsync(keyed, salt, 32);
}

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await derive(pin, salt)).toString("hex")}`;
}

async function matches(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await derive(pin, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function getPinState(customerId: string): Promise<{ hasPin: boolean; required: boolean }> {
  const { rows } = await getPool().query<{ has_pin: boolean; required: boolean }>(
    "select pin_hash is not null as has_pin, required from customer_pins where customer_id = $1",
    [customerId],
  );
  return { hasPin: rows[0]?.has_pin ?? false, required: rows[0]?.required ?? true };
}

type PinRow = { pin_hash: string | null; required: boolean; failed_attempts: number; locked_until: Date | null };

export async function verifyPin(customerId: string, pin: unknown): Promise<PinResult> {
  const state = await getPinState(customerId);
  if (!state.required) return { ok: true };

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<PinRow>(
      "select pin_hash, required, failed_attempts, locked_until from customer_pins where customer_id = $1 for update",
      [customerId],
    );
    const row = rows[0];
    if (!row?.pin_hash) {
      await client.query("rollback");
      return { ok: false, error: "Set up your transaction PIN first." };
    }
    if (row.locked_until && row.locked_until.getTime() > Date.now()) {
      await client.query("rollback");
      const minutes = Math.max(1, Math.ceil((row.locked_until.getTime() - Date.now()) / 60_000));
      return { ok: false, error: `Too many wrong attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
    }
    if (typeof pin !== "string" || !PIN_PATTERN.test(pin)) {
      await client.query("rollback");
      return { ok: false, error: "Enter your 4-digit PIN." };
    }
    if (await matches(pin, row.pin_hash)) {
      await client.query(
        "update customer_pins set failed_attempts = 0, locked_until = null where customer_id = $1",
        [customerId],
      );
      await client.query("commit");
      return { ok: true };
    }
    const failed = row.failed_attempts + 1;
    if (failed >= MAX_ATTEMPTS) {
      await client.query(
        "update customer_pins set failed_attempts = 0, locked_until = now() + make_interval(mins => $2::int) where customer_id = $1",
        [customerId, LOCK_MINUTES],
      );
      await client.query("commit");
      return { ok: false, error: `Too many wrong attempts. Your PIN is locked for ${LOCK_MINUTES} minutes.` };
    }
    await client.query("update customer_pins set failed_attempts = $2 where customer_id = $1", [customerId, failed]);
    await client.query("commit");
    const left = MAX_ATTEMPTS - failed;
    return { ok: false, error: `Wrong PIN. ${left} attempt${left === 1 ? "" : "s"} left.` };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

const UPSERT = `insert into customer_pins (customer_id, pin_hash) values ($1, $2)
  on conflict (customer_id) do update
    set pin_hash = excluded.pin_hash, required = true, failed_attempts = 0, locked_until = null, updated_at = now()`;

export async function setInitialPin(customerId: string, pin: string): Promise<boolean> {
  const result = await getPool().query(`${UPSERT} where customer_pins.pin_hash is null`, [customerId, await hashPin(pin)]);
  return (result.rowCount ?? 0) > 0;
}

export async function changePin(customerId: string, current: unknown, next: string): Promise<PinResult> {
  const check = await verifyPin(customerId, current);
  if (!check.ok) return check;
  await getPool().query(UPSERT, [customerId, await hashPin(next)]);
  return { ok: true };
}

export async function removePin(customerId: string, current: unknown): Promise<PinResult> {
  const check = await verifyPin(customerId, current);
  if (!check.ok) return check;
  await getPool().query(
    `insert into customer_pins (customer_id, pin_hash, required) values ($1, null, false)
     on conflict (customer_id) do update
       set pin_hash = null, required = false, failed_attempts = 0, locked_until = null, updated_at = now()`,
    [customerId],
  );
  return { ok: true };
}

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const sha = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createResetToken(customerId: string): Promise<string | null> {
  const pool = getPool();
  const recent = await pool.query(
    "select 1 from pin_reset_tokens where customer_id = $1 and created_at > now() - interval '1 minute'",
    [customerId],
  );
  if (recent.rowCount) return null;
  const token = randomBytes(32).toString("base64url");
  await pool.query("delete from pin_reset_tokens where customer_id = $1 and used_at is null", [customerId]);
  await pool.query(
    "insert into pin_reset_tokens (token_hash, customer_id, expires_at) values ($1, $2, now() + interval '30 minutes')",
    [sha(token), customerId],
  );
  return token;
}

export async function peekResetToken(customerId: string, token: string): Promise<boolean> {
  if (!TOKEN.test(token)) return false;
  const { rowCount } = await getPool().query(
    "select 1 from pin_reset_tokens where token_hash = $1 and customer_id = $2 and used_at is null and expires_at > now()",
    [sha(token), customerId],
  );
  return (rowCount ?? 0) > 0;
}

export async function resetPinWithToken(customerId: string, token: string, pin: string): Promise<boolean> {
  if (!TOKEN.test(token)) return false;
  const hash = await hashPin(pin);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const used = await client.query(
      `update pin_reset_tokens set used_at = now()
       where token_hash = $1 and customer_id = $2 and used_at is null and expires_at > now()`,
      [sha(token), customerId],
    );
    if (!used.rowCount) {
      await client.query("rollback");
      return false;
    }
    await client.query(UPSERT, [customerId, hash]);
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
