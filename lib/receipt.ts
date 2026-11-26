import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_DAYS = 30;
const ID = /^[\w-]{1,100}$/;

function secret(): string {
  const value = process.env.RECEIPT_SECRET;
  if (!value || value.length < 32) throw new Error("RECEIPT_SECRET must be set to at least 32 characters.");
  return value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function signReceiptToken(id: string): string {
  const expires = Math.floor(Date.now() / 1000) + TTL_DAYS * 86_400;
  const payload = `${id}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the transaction id, or null if the token is malformed, forged or expired. */
export function verifyReceiptToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, expires, signature] = parts;
  if (!ID.test(id) || !/^\d{1,12}$/.test(expires) || Number(expires) < Date.now() / 1000) return null;
  const expected = Buffer.from(sign(`${id}.${expires}`));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}

/** "Decoder 7021000441 · Jane Doe" -> "Decoder ••••0441". */
export function maskDetail(detail: string): string {
  return detail
    .split(" · ")[0]
    .replace(/\d[\d\s]{5,}\d/g, (run) => `••••${run.replace(/\D/g, "").slice(-4)}`);
}

export function receiptUrls(token: string) {
  const base = (process.env.APP_URL ?? "").trim().replace(/\/$/, "");
  return { page: `${base}/receipts/${token}`, image: `${base}/receipts/${token}/image` };
}
