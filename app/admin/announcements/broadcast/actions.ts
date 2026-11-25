"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import {
  BODY_LIMIT,
  BROADCAST_PATH,
  SMS_LIMIT,
  SUBJECT_LIMIT,
  isAudience,
  isChannel,
  type Audience,
  type Channel,
} from "@/lib/admin/announcements";
import { processBroadcast } from "@/lib/broadcast";
import { countAudience, createBroadcast } from "@/lib/db/announcements";
import { getPackage } from "@/lib/db/packages";
import { channelAvailability } from "@/lib/messaging/send";

export type BroadcastInput = { title: string; body: string; channels: Channel[]; audience: Audience; packageId: string | null };
export type PreviewResult = { ok: true; count: number } | { ok: false; error: string };
export type SendResult = { ok: true } | { ok: false; error: string };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

async function resolveAudience(audience: unknown, packageId: unknown): Promise<{ audience: Audience; packageId: string | null } | string> {
  if (!isAudience(audience)) return "Choose who should receive this.";
  if (audience !== "package") return { audience, packageId: null };
  const id = text(packageId);
  if (!id || !(await getPackage(id))) return "Choose a package.";
  return { audience, packageId: id };
}

export async function previewAudience(audienceInput: unknown, packageInput: unknown): Promise<PreviewResult> {
  await requirePermission("announcements.manage");
  const audience = await resolveAudience(audienceInput, packageInput);
  if (typeof audience === "string") return { ok: false, error: audience };
  return { ok: true, count: await countAudience(audience.audience, audience.packageId) };
}

export async function sendBroadcast(input: BroadcastInput): Promise<SendResult> {
  const admin = await requirePermission("announcements.manage");
  if (!input || typeof input !== "object") return { ok: false, error: "Check the message and try again." };

  const title = text(input.title);
  const body = text(input.body);
  if (!title || title.length > SUBJECT_LIMIT) return { ok: false, error: `Enter a title up to ${SUBJECT_LIMIT} characters.` };
  if (!body || body.length > BODY_LIMIT) return { ok: false, error: `Enter a message up to ${BODY_LIMIT} characters.` };

  const channels = Array.isArray(input.channels) ? [...new Set(input.channels.filter(isChannel))] : [];
  if (channels.length === 0) return { ok: false, error: "Choose at least one channel." };
  const availability = channelAvailability();
  const blocked = channels.find((channel) => !availability[channel].available);
  if (blocked) return { ok: false, error: `${blocked} isn't set up yet. Untick it and try again.` };
  if (channels.includes("sms") && body.length > SMS_LIMIT) return { ok: false, error: `SMS messages can be up to ${SMS_LIMIT} characters.` };

  const audience = await resolveAudience(input.audience, input.packageId);
  if (typeof audience === "string") return { ok: false, error: audience };

  try {
    const total = await countAudience(audience.audience, audience.packageId);
    if (total === 0) return { ok: false, error: "No customers match that audience." };
    const id = randomUUID();
    await createBroadcast({ id, title, body, channels, ...audience, total, createdBy: admin.sub });
    after(() => processBroadcast(id));
    revalidatePath(BROADCAST_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[broadcast]", error);
    return { ok: false, error: "Something went wrong sending that. Check the history before trying again." };
  }
}
