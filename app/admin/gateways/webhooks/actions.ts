"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { MAX_MINUTES, MIN_AUTO_FAIL_MINUTES, WEBHOOKS_PATH } from "@/lib/admin/webhooks";
import { regenerateWebhookToken, setAutoFailMinutes } from "@/lib/db/webhooks";
import { failPending } from "@/lib/settlement";

export type WebhookActionResult = { ok: true; message: string } | { ok: false; error: string };

const fail = (error: string): WebhookActionResult => ({ ok: false, error });
const isMinutes = (value: unknown, min: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= MAX_MINUTES;

export async function saveAutoFail(minutes: number): Promise<WebhookActionResult> {
  await requirePermission("settings.manage");
  if (minutes !== 0 && !isMinutes(minutes, MIN_AUTO_FAIL_MINUTES)) {
    return fail(`Enter 0 to turn it off, or ${MIN_AUTO_FAIL_MINUTES} to ${MAX_MINUTES} minutes.`);
  }

  try {
    await setAutoFailMinutes(minutes);
    revalidatePath(WEBHOOKS_PATH);
    return {
      ok: true,
      message: minutes === 0 ? "Auto-fail is off." : `Pending transactions will fail after ${minutes} minutes.`,
    };
  } catch (error) {
    console.error("[webhooks] Could not save auto-fail setting", error);
    return fail("Something went wrong saving that. Try again.");
  }
}

export async function failPendingNow(olderThanMinutes: number): Promise<WebhookActionResult> {
  await requirePermission("settings.manage");
  if (!isMinutes(olderThanMinutes, 0)) return fail(`Enter 0 to ${MAX_MINUTES} minutes.`);

  try {
    const report = await failPending(olderThanMinutes, "Marked as failed by an admin.");
    revalidatePath(WEBHOOKS_PATH);
    revalidatePath("/admin");
    revalidatePath("/admin/transactions/list");

    if (report.failed === 0) return { ok: true, message: "No pending transactions matched." };
    const parts = [`Failed ${report.failed} pending transaction${report.failed === 1 ? "" : "s"}`];
    parts.push(`${report.refunded} refunded`);
    if (report.refundNeeded > 0) parts.push(`${report.refundNeeded} still need a refund (see History)`);
    if (report.unverified > 0) parts.push(`${report.unverified} had no recorded debit, so check those wallets`);
    return { ok: true, message: `${parts.join(", ")}.` };
  } catch (error) {
    console.error("[webhooks] Could not fail pending transactions", error);
    return fail("Something went wrong. Check History before trying again.");
  }
}

export async function regenerateToken(providerId: string): Promise<WebhookActionResult> {
  await requirePermission("settings.manage");
  if (typeof providerId !== "string" || !providerId) return fail("That change isn't valid. Refresh the page.");

  try {
    if (!(await regenerateWebhookToken(providerId))) return fail("That provider no longer exists. Refresh the page.");
    revalidatePath(WEBHOOKS_PATH);
    return { ok: true, message: "New webhook URL created. Update it on the provider's website." };
  } catch (error) {
    console.error("[webhooks] Could not regenerate token", error);
    return fail("Something went wrong. Try again.");
  }
}
