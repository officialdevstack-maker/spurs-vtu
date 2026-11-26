"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { TEMPLATES_PATH } from "@/lib/admin/announcements";
import {
  DEFAULT_MESSAGES,
  MESSAGE_LIMIT,
  PURCHASE_SERVICES,
  PURCHASE_STATUSES,
  isPurchaseService,
  isPurchaseStatus,
  placeholdersFor,
  type PurchaseTemplate,
} from "@/lib/admin/purchase-templates";
import { savePurchaseTemplates } from "@/lib/db/purchase-templates";

export type TemplatesResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): TemplatesResult => ({ ok: false, error });

export async function saveTemplates(input: PurchaseTemplate[]): Promise<TemplatesResult> {
  await requirePermission("announcements.manage");
  if (!Array.isArray(input) || input.length > PURCHASE_SERVICES.length * PURCHASE_STATUSES.length) return fail("Check the messages and try again.");
  const seen = new Set<string>();
  const overrides: PurchaseTemplate[] = [];
  const resets: { service: PurchaseTemplate["service"]; status: PurchaseTemplate["status"] }[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object" || !isPurchaseService(item.service) || !isPurchaseStatus(item.status)) return fail("Check the messages and try again.");
    const key = `${item.service}:${item.status}`;
    if (seen.has(key)) return fail("Check the messages and try again.");
    seen.add(key);
    const message = typeof item.message === "string" ? item.message.trim() : "";
    const label = `${PURCHASE_SERVICES.find((s) => s.id === item.service)?.label} ${item.status}`;
    if (!message) return fail(`${label}: enter a message.`);
    if (message.length > MESSAGE_LIMIT) return fail(`${label}: keep it under ${MESSAGE_LIMIT} characters.`);
    const allowed = new Set(placeholdersFor(item.service, item.status).map((p) => p.key));
    for (const match of message.matchAll(/\{(\w+)\}/g)) {
      if (!allowed.has(match[1])) return fail(`${label}: {${match[1]}} isn't available here.`);
    }
    if (message === DEFAULT_MESSAGES[item.service][item.status]) resets.push({ service: item.service, status: item.status });
    else overrides.push({ service: item.service, status: item.status, message });
  }
  try {
    await savePurchaseTemplates(overrides, resets);
    revalidatePath(TEMPLATES_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[purchase-templates]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}
