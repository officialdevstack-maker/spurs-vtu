export type Channel = "system" | "email" | "sms" | "push";
export type Audience = "all" | "package" | "staff";

export const CHANNELS: { id: Channel; label: string; hint: string; hasSubject: boolean }[] = [
  { id: "system", label: "In-app", hint: "Shows in the customer's notifications.", hasSubject: true },
  { id: "email", label: "Email", hint: "Sent to the customer's email address.", hasSubject: true },
  { id: "sms", label: "SMS", hint: "Sent to the customer's phone number. Keep it short.", hasSubject: false },
  { id: "push", label: "Push", hint: "Sent to the customer's devices.", hasSubject: true },
];

export const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "all", label: "All active customers" },
  { id: "package", label: "Customers on a package" },
  { id: "staff", label: "Staff only" },
];

export const isChannel = (value: unknown): value is Channel =>
  CHANNELS.some((channel) => channel.id === value);
export const isAudience = (value: unknown): value is Audience =>
  AUDIENCES.some((audience) => audience.id === value);

export const SMS_LIMIT = 320;
export const SUBJECT_LIMIT = 120;
export const BODY_LIMIT = 2000;

export const POPUP_TITLE_LIMIT = 80;
export const POPUP_BODY_LIMIT = 500;
export const POPUP_CTA_LIMIT = 30;

export type ChannelAvailability = Record<Channel, { available: boolean; reason?: string }>;
export type WelcomePopup = {
  enabled: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  version: number;
};
export type Recipient = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
  notifyPromotions: boolean;
};
export type ChannelResult = { sent: number; failed: number; skipped: number };
export type BroadcastResults = Partial<Record<Channel, ChannelResult>>;
export type BroadcastRecord = {
  id: string;
  title: string;
  body: string;
  channels: Channel[];
  audience: Audience;
  packageName: string | null;
  status: "sending" | "sent" | "failed";
  total: number;
  processed: number;
  results: BroadcastResults;
  createdAt: string;
  finishedAt: string | null;
};
export type NotificationItem = { id: string; title: string; body: string; read: boolean; at: string };

export const ANNOUNCEMENTS_PATH = "/admin/announcements";
export const WELCOME_PATH = "/admin/announcements/welcome";
export const BROADCAST_PATH = "/admin/announcements/broadcast";
export const TEMPLATES_PATH = "/admin/announcements/templates";

export function renderTemplate(text: string, who: { name: string | null; username: string | null }): string {
  const first = who.name?.trim().split(/\s+/)[0] || who.username?.trim() || "there";
  return text.replace(/\{name\}/g, first).replace(/\{username\}/g, who.username?.trim() || first);
}
