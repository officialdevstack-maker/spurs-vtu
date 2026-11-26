"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { TEMPLATES_PATH } from "@/lib/admin/announcements";
import {
  MESSAGE_LIMIT,
  MAX_TEMPLATES,
  NAME_LIMIT,
  isPurchaseService,
  isPurchaseStatus,
  placeholdersFor,
  type PurchaseTemplateFields,
} from "@/lib/admin/purchase-templates";
import * as db from "@/lib/db/purchase-templates";
import { recordAudit } from "@/lib/db/audit";

export type TemplateResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): TemplateResult => ({ ok: false, error });
const BAD_INPUT = fail("That change isn't valid. Refresh the page and try again.");
const NOT_FOUND = fail("That template no longer exists. Refresh the page.");
const clean = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

function parseTemplate(input: unknown): PurchaseTemplateFields | string {
  if (!input || typeof input !== "object") return "Check the template and try again.";
  const raw = input as Record<string, unknown>;
  const name = clean(raw.name);
  if (!name || name.length > NAME_LIMIT) return `Enter a name up to ${NAME_LIMIT} characters.`;
  if (!isPurchaseService(raw.service)) return "Choose a service.";
  if (!isPurchaseStatus(raw.status)) return "Choose a status.";
  if (typeof raw.active !== "boolean") return "Check the template and try again.";
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  if (!message) return "Enter a message.";
  if (message.length > MESSAGE_LIMIT) return `Keep the message under ${MESSAGE_LIMIT} characters.`;
  const allowed = new Set(placeholdersFor(raw.service, raw.status).map((p) => p.key));
  for (const match of message.matchAll(/\{(\w+)\}/g)) {
    if (!allowed.has(match[1])) return `{${match[1]}} isn't available for this service and status.`;
  }
  return { name, service: raw.service, status: raw.status, message, active: raw.active };
}

async function run(fn: () => Promise<boolean | void>): Promise<TemplateResult> {
  try {
    if ((await fn()) === false) return NOT_FOUND;
    revalidatePath(TEMPLATES_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[purchase-templates]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}

export async function createTemplate(input: unknown): Promise<TemplateResult> {
  const admin = await requirePermission("announcements.manage");
  const template = parseTemplate(input);
  if (typeof template === "string") return fail(template);
  if ((await db.countPurchaseTemplates()) >= MAX_TEMPLATES) return fail(`You can keep up to ${MAX_TEMPLATES} templates. Delete one you don't use.`);
  return run(async () => {
    await db.createPurchaseTemplate(template);
    await recordAudit(admin, { action: "template.create", summary: `Created purchase template ${template.name}`, meta: { service: template.service, status: template.status, active: template.active } });
  });
}

export async function updateTemplate(id: string, input: unknown): Promise<TemplateResult> {
  const admin = await requirePermission("announcements.manage");
  if (typeof id !== "string" || !id) return BAD_INPUT;
  const template = parseTemplate(input);
  if (typeof template === "string") return fail(template);
  return run(async () => {
    const updated = await db.updatePurchaseTemplate(id, template);
    if (updated) await recordAudit(admin, { action: "template.update", target: id, summary: `Updated purchase template ${template.name}`, meta: { service: template.service, status: template.status, active: template.active } });
    return updated;
  });
}

export async function setTemplateActive(id: string, active: boolean): Promise<TemplateResult> {
  const admin = await requirePermission("announcements.manage");
  if (typeof id !== "string" || !id || typeof active !== "boolean") return BAD_INPUT;
  return run(async () => {
    const updated = await db.setPurchaseTemplateActive(id, active);
    if (updated) await recordAudit(admin, { action: "template.toggle", target: id, summary: active ? "Activated a purchase template" : "Deactivated a purchase template", meta: { active } });
    return updated;
  });
}

export async function removeTemplate(id: string): Promise<TemplateResult> {
  const admin = await requirePermission("announcements.manage");
  if (typeof id !== "string" || !id) return BAD_INPUT;
  return run(async () => {
    const deleted = await db.deletePurchaseTemplate(id);
    if (deleted) await recordAudit(admin, { action: "template.delete", target: id, summary: "Deleted a purchase template" });
    return deleted;
  });
}
