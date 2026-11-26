"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { POPUP_BODY_LIMIT, POPUP_CTA_LIMIT, POPUP_TITLE_LIMIT, WELCOME_PATH } from "@/lib/admin/announcements";
import { saveWelcomePopup } from "@/lib/db/announcements";
import { recordAudit } from "@/lib/db/audit";

export type WelcomeInput = { enabled: boolean; title: string; body: string; ctaLabel: string; ctaHref: string; showAgain: boolean };
export type WelcomeResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): WelcomeResult => ({ ok: false, error });
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function saveWelcome(input: WelcomeInput): Promise<WelcomeResult> {
  const admin = await requirePermission("announcements.manage");
  if (!input || typeof input !== "object") return fail("Check the message and try again.");
  const title = text(input.title);
  const body = text(input.body);
  const ctaLabel = text(input.ctaLabel);
  const ctaHref = text(input.ctaHref);
  if (title.length > POPUP_TITLE_LIMIT) return fail(`The title can be up to ${POPUP_TITLE_LIMIT} characters.`);
  if (body.length > POPUP_BODY_LIMIT) return fail(`The message can be up to ${POPUP_BODY_LIMIT} characters.`);
  if (ctaLabel.length > POPUP_CTA_LIMIT) return fail(`The button label can be up to ${POPUP_CTA_LIMIT} characters.`);
  if (input.enabled === true && (!title || !body)) return fail("Add a title and a message before turning it on.");
  if (!!ctaLabel !== !!ctaHref) return fail("Add both a button label and a link, or leave both empty.");
  if (ctaHref && (!ctaHref.startsWith("/") || ctaHref.startsWith("//") || /\s/.test(ctaHref))) return fail("The link must be a page on this site, like /fund-wallet.");

  try {
    await saveWelcomePopup({ enabled: input.enabled === true, title, body, ctaLabel, ctaHref }, input.showAgain === true);
    await recordAudit(admin, { action: "welcome.save", summary: input.enabled ? "Updated and enabled the welcome popup" : "Updated and disabled the welcome popup", meta: { enabled: input.enabled, showAgain: input.showAgain === true } });
    revalidatePath(WELCOME_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[welcome]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}
