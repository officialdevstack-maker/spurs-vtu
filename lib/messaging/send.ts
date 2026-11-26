import "server-only";
import { normalizePhone, PHONE_PATTERN } from "@/lib/phone";
import type { ChannelAvailability, Recipient } from "@/lib/admin/announcements";
import { pushConfigured, pushToCustomer } from "@/lib/push";

const TIMEOUT_MS = 10_000;

export function channelAvailability(): ChannelAvailability {
  const email = !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;
  const sms = !!process.env.TERMII_API_KEY && !!process.env.TERMII_SENDER_ID;
  return {
    system: { available: true },
    email: email ? { available: true } : { available: false, reason: "Set RESEND_API_KEY and MAIL_FROM to turn this on." },
    sms: sms ? { available: true } : { available: false, reason: "Set TERMII_API_KEY and TERMII_SENDER_ID to turn this on." },
    push: pushConfigured()
      ? { available: true }
      : { available: false, reason: "Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT to turn this on." },
  };
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}

export { sendEmail };

async function sendSms(phone: string, text: string): Promise<void> {
  const response = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: `234${phone.slice(1)}`,
      from: process.env.TERMII_SENDER_ID,
      sms: text,
      type: "plain",
      channel: "generic",
      api_key: process.env.TERMII_API_KEY,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`SMS provider returned ${response.status}`);
}

export async function deliver(
  channel: "email" | "sms" | "push",
  recipient: Recipient,
  subject: string,
  body: string,
): Promise<"sent" | "failed" | "skipped"> {
  try {
    if (channel === "email") {
      if (!recipient.email) return "skipped";
      await sendEmail(recipient.email, subject, body);
      return "sent";
    }
    if (channel === "sms") {
      const phone = normalizePhone(recipient.phone ?? "");
      if (!PHONE_PATTERN.test(phone)) return "skipped";
      await sendSms(phone, body);
      return "sent";
    }
    if (channel === "push") return await pushToCustomer(recipient.id, { title: subject, body });
    return "failed";
  } catch (error) {
    console.error(`[messaging] ${channel} delivery failed`, recipient.id, error instanceof Error ? error.message : error);
    return "failed";
  }
}
