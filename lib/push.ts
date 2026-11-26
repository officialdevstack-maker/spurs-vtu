import "server-only";
import webpush from "web-push";
import { deleteByEndpoint, listWebSubscriptions, touchEndpoint } from "@/lib/db/push";

export const pushConfigured = () =>
  !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY && !!process.env.VAPID_SUBJECT;

let ready = false;
function init() {
  if (ready) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

export async function pushToCustomer(customerId: string, message: PushMessage): Promise<"sent" | "failed" | "skipped"> {
  if (!pushConfigured()) return "skipped";
  const subs = await listWebSubscriptions(customerId);
  if (subs.length === 0) return "skipped";
  init();

  const payload = JSON.stringify({
    title: message.title.slice(0, 100),
    body: message.body.slice(0, 300),
    url: message.url ?? "/dashboard/notifications",
    tag: message.tag,
  });

  const results = await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 86_400, timeout: 10_000 },
        );
        await touchEndpoint(sub.endpoint).catch(() => undefined);
        return true;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await deleteByEndpoint(sub.endpoint).catch(() => undefined);
        else console.error("[push] Send failed", customerId, status ?? (error instanceof Error ? error.message : error));
        return false;
      }
    }),
  );
  return results.some(Boolean) ? "sent" : "failed";
}
