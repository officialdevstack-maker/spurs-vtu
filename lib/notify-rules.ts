import type { ProfileSettings } from "@/lib/profile";

export type NotifyCategory = "security" | "transaction" | "promotion" | "system";
export type ExternalChannel = "email" | "sms" | "push";

/** Which outside channels a customer wants for this kind of message. In-app is always on. */
export function externalChannels(category: NotifyCategory, settings: ProfileSettings): ExternalChannel[] {
  const wants = {
    security: { email: true, sms: settings.notifySms, push: settings.notifyPush },
    transaction: {
      email: settings.notifyEmail && settings.notifyTransactions,
      sms: settings.notifySms && settings.notifyTransactions,
      push: settings.notifyPush && settings.notifyTransactions,
    },
    promotion: {
      email: settings.notifyEmail && settings.notifyPromotions,
      sms: settings.notifySms && settings.notifyPromotions,
      push: settings.notifyPush && settings.notifyPromotions,
    },
    system: { email: settings.notifyEmail, sms: false, push: settings.notifyPush },
  }[category];

  const channels: ExternalChannel[] = [];
  if (wants.email) channels.push("email");
  if (wants.sms) channels.push("sms");
  if (wants.push) channels.push("push");
  return channels;
}
