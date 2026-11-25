"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { BODY_LIMIT, CHANNELS, SMS_LIMIT, SUBJECT_LIMIT, WELCOME_PATH, isChannel, type WelcomeTemplate } from "@/lib/admin/announcements";
import { saveWelcomeTemplates } from "@/lib/db/announcements";
import { channelAvailability } from "@/lib/messaging/send";

export type WelcomeResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): WelcomeResult => ({ ok: false, error });
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function saveWelcome(input: WelcomeTemplate[]): Promise<WelcomeResult> {
  await requirePermission("announcements.manage");
  if (!Array.isArray(input) || input.length > CHANNELS.length) return fail("Check the messages and try again.");

  const availability = channelAvailability();
  const seen = new Set<string>();
  const templates: WelcomeTemplate[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object" || !isChannel(item.channel) || seen.has(item.channel)) {
      return fail("Check the messages and try again.");
    }
    seen.add(item.channel);
    const meta = CHANNELS.find((c) => c.id === item.channel)!;
    const subject = meta.hasSubject ? text(item.subject) : "";
    const body = text(item.body);
    const enabled = item.enabled === true;
    if (subject.length > SUBJECT_LIMIT) return fail(`${meta.label}: the title can be up to ${SUBJECT_LIMIT} characters.`);
    if (body.length > (item.channel === "sms" ? SMS_LIMIT : BODY_LIMIT)) return fail(`${meta.label}: the message is too long.`);
    if (enabled) {
      if (!availability[item.channel].available) return fail(`${meta.label} isn't set up yet, so it can't be turned on.`);
      if (!body || (meta.hasSubject && !subject)) return fail(`${meta.label}: add a ${meta.hasSubject ? "title and " : ""}message.`);
    }
    templates.push({ channel: item.channel, enabled, subject, body });
  }

  try {
    await saveWelcomeTemplates(templates);
    revalidatePath(WELCOME_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[welcome]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}
