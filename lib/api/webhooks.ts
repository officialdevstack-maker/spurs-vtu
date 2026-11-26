import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { decryptSecret } from "@/lib/crypto";
import { claimDueDeliveries, enqueueOrderEvent, markAttemptFailed, markDelivered, type ClaimedDelivery } from "@/lib/db/api-webhooks";

const RETRY_DELAYS = [60, 300, 1800, 7200, 21600];
const SEND_TIMEOUT_MS = 8_000;
const BATCH = 10;

export class WebhookUrlError extends Error {}
export const generateWebhookSecret = () => `whsec_${randomBytes(32).toString("base64url")}`;

function isPrivateAddress(address: string): boolean {
  if (address.toLowerCase().startsWith("::ffff:")) return isPrivateAddress(address.slice(7));
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const value = address.toLowerCase();
  return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value);
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new WebhookUrlError("Enter a full address, like https://example.com/vtu-webhook."); }
  if (url.protocol !== "https:") throw new WebhookUrlError("The webhook address must use https://.");
  if (url.username || url.password) throw new WebhookUrlError("Don't put credentials in the address.");
  if (url.port && url.port !== "443") throw new WebhookUrlError("The webhook address must use the standard HTTPS port.");
  if (url.hash) throw new WebhookUrlError("The webhook address can't include a fragment.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new WebhookUrlError("That address isn't reachable from the internet.");
    return url;
  }
  let addresses: { address: string }[];
  try { addresses = await lookup(host, { all: true }); } catch { throw new WebhookUrlError("We couldn't find that domain. Check the address."); }
  if (addresses.length === 0 || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new WebhookUrlError("That address isn't reachable from the internet.");
  }
  return url;
}

async function send(delivery: ClaimedDelivery): Promise<void> {
  const retry = (error: string, httpStatus: number | null) =>
    markAttemptFailed(delivery.id, error.slice(0, 200), httpStatus, RETRY_DELAYS[delivery.attempts - 1] ?? null);
  if (!delivery.url || !delivery.secret_enc || !delivery.enabled) {
    await markAttemptFailed(delivery.id, "Webhook is off or was removed.", null, null);
    return;
  }
  try {
    const url = await assertPublicUrl(delivery.url);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", decryptSecret(delivery.secret_enc))
      .update(`${timestamp}.${delivery.payload}`).digest("hex");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "User-Agent": "SpurVTU-Webhooks/1",
        "X-Vtu-Event": delivery.event, "X-Vtu-Delivery": delivery.id,
        "X-Vtu-Timestamp": timestamp, "X-Vtu-Signature": `sha256=${signature}`,
      },
      body: delivery.payload, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => undefined);
    if (response.ok) await markDelivered(delivery.id, response.status);
    else await retry(`Your server answered ${response.status}.`, response.status);
  } catch (error) {
    await retry(error instanceof Error ? error.message : "Delivery failed.", null);
  }
}

export async function deliverDue(budgetMs = 20_000): Promise<{ sent: number }> {
  const started = Date.now();
  let sent = 0;
  while (Date.now() - started < budgetMs) {
    const batch = await claimDueDeliveries(BATCH);
    if (batch.length === 0) break;
    await Promise.all(batch.map(send));
    sent += batch.length;
  }
  return { sent };
}

export async function publishOrderEvent(transactionId: string): Promise<void> {
  try {
    if (await enqueueOrderEvent(transactionId)) await deliverDue(10_000);
  } catch (error) {
    console.error("[api-webhooks] Could not publish", transactionId, error);
  }
}
