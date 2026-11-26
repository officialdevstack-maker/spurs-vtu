import type { ProfileSettings } from "@/lib/profile";

export type NotifyCategory = "security" | "transaction" | "promotion" | "system";
export type ExternalChannel = "email" | "sms";

/** Which outside channels a customer wants for this kind of message. In-app is always on. */
export function externalChannels(category: NotifyCategory, settings: ProfileSettings): ExternalChannel[] {
  const wants = {
    security: { email: true, sms: settings.notifySms },
    transaction: {
      email: settings.notifyEmail && settings.notifyTransactions,
      sms: settings.notifySms && settings.notifyTransactions,
    },
    promotion: {
      email: settings.notifyEmail && settings.notifyPromotions,
      sms: settings.notifySms && settings.notifyPromotions,
    },
    system: { email: settings.notifyEmail, sms: false },
  }[category];

  const channels: ExternalChannel[] = [];
  if (wants.email) channels.push("email");
  if (wants.sms) channels.push("sms");
  return channels;
}
