import "server-only";
import type { Recipient } from "@/lib/admin/announcements";
import { getNotifyTarget, insertNotificationOnce } from "@/lib/db/notify";
import { getProfileSettings } from "@/lib/db/profile";
import { externalChannels, type NotifyCategory } from "@/lib/notify-rules";
import { deliver } from "@/lib/messaging/send";

export type NotifyEvent = {
  /** Stable and unique per event, e.g. `tx-${reference}`. Repeats are ignored. */
  id: string;
  category: NotifyCategory;
  title: string;
  body: string;
};

const SMS_MAX = 320;

export async function notify(customerId: string, event: NotifyEvent): Promise<void> {
  try {
    const isNew = await insertNotificationOnce({
      id: event.id,
      customerId,
      title: event.title,
      body: event.body,
    });
    if (!isNew) return;

    const [target, settings] = await Promise.all([
      getNotifyTarget(customerId),
      getProfileSettings(customerId),
    ]);
    if (!target) return;

    const channels = externalChannels(event.category, settings);
    const base = process.env.APP_URL?.trim().replace(/\/$/, "") ?? "";
    const recipient: Recipient = {
      id: customerId,
      name: null,
      username: null,
      email: target.email,
      phone: target.phone,
      notifyEmail: settings.notifyEmail,
      notifySms: settings.notifySms,
      notifyPush: settings.notifyPush,
      notifyPromotions: settings.notifyPromotions,
    };
    const jobs: Promise<"sent" | "failed" | "skipped">[] = [];

    if (channels.includes("email") && target.email) {
      jobs.push(
        deliver(
          "email",
          recipient,
          event.title,
          `${event.body}\n\n${base ? `Manage notifications: ${base}/dashboard/profile` : ""}`.trim(),
        ),
      );
    }

    if (channels.includes("sms") && target.phone) {
      jobs.push(deliver("sms", recipient, event.title, `${event.title}: ${event.body}`.slice(0, SMS_MAX)));
    }

    const results = await Promise.allSettled(jobs);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[notify] Send failed", event.id, result.reason);
      }
    }
  } catch (error) {
    console.error("[notify] Could not notify", event.id, error);
  }
}
