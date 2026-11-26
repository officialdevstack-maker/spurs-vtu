"use server";

import { revalidatePath } from "next/cache";
import { requireSpursUser } from "@/lib/spurs";
import { saveProfile } from "@/lib/db/profile";
import { normalizePhone, PHONE_PATTERN } from "@/lib/phone";
import { PROFILE_PATH, parseSettings } from "@/lib/profile";

export type ProfileResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ProfileResult => ({ ok: false, error });

export async function saveProfileAction(input: unknown): Promise<ProfileResult> {
  const user = await requireSpursUser();
  if (!input || typeof input !== "object") return fail("Check your details and try again.");
  const raw = input as Record<string, unknown>;
  const settings = parseSettings(raw.settings);
  if (!settings || typeof raw.phone !== "string") return fail("Check your details and try again.");

  const phone = raw.phone.trim() ? normalizePhone(raw.phone) : null;
  if (phone && !PHONE_PATTERN.test(phone)) return fail("Enter an 11-digit phone number, like 0803 123 4567.");

  try {
    await saveProfile(user.sub, phone, settings);
    revalidatePath(PROFILE_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[profile]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}
