"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { MAX_MINUTES, MIN_AUTO_FAIL_MINUTES, MIN_FAIL_NOW_MINUTES, WEBHOOKS_PATH } from "@/lib/admin/webhooks";
import { regenerateWebhookToken, setAutoFailMinutes } from "@/lib/db/webhooks";
import { failPending } from "@/lib/settlement";
import { recordAudit } from "@/lib/db/audit";

export type WebhookActionResult = { ok: true; message: string } | { ok: false; error: string };

const fail = (error: string): WebhookActionResult => ({ ok: false, error });
const isMinutes = (value: unknown, min: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= MAX_MINUTES;

export async function saveAutoFail(minutes: number): Promise<WebhookActionResult> {
  const admin = await requirePermission("settings.manage");
  if (minutes !== 0 && !isMinutes(minutes, MIN_AUTO_FAIL_MINUTES)) {
    return fail(`Enter 0 to turn it off, or ${MIN_AUTO_FAIL_MINUTES} to ${MAX_MINUTES} minutes.`);
  }

  try {
    await setAutoFailMinutes(minutes);
    await recordAudit(admin, {
      action: "settings.auto_fail",
      summary: minutes === 0 ? "Turned auto-fail off" : `Set auto-fail to ${minutes} minutes`,
      meta: { minutes },
    });
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
  const admin = await requirePermission("settings.manage");
  if (!isMinutes(olderThanMinutes, MIN_FAIL_NOW_MINUTES)) {
    return fail(`Enter ${MIN_FAIL_NOW_MINUTES} to ${MAX_MINUTES} minutes, so orders still in flight aren't failed.`);
  }

  try {
    const report = await failPending(olderThanMinutes, "Marked as failed by an admin.");
    await recordAudit(admin, {
      action: "transactions.fail_pending",
      summary: `Failed ${report.failed} pending transactions older than ${olderThanMinutes} minutes`,
      meta: { olderThanMinutes, ...report },
    });
    revalidatePath(WEBHOOKS_PATH);
    revalidatePath("/admin");
    revalidatePath("/admin/transactions/list");

    if (report.failed === 0) return { ok: true, message: "No pending transactions matched." };
    const parts = [`Failed ${report.failed} pending transaction${report.failed === 1 ? "" : "s"}`];
    parts.push(`${report.refunded} refunded`);
    if (report.refundNeeded > 0) parts.push(`${report.refundNeeded} still need a refund (see History)`);
    return { ok: true, message: `${parts.join(", ")}.` };
  } catch (error) {
    console.error("[webhooks] Could not fail pending transactions", error);
    return fail("Something went wrong. Check History before trying again.");
  }
}

export async function regenerateToken(providerId: string): Promise<WebhookActionResult> {
  const admin = await requirePermission("settings.manage");
  if (typeof providerId !== "string" || !providerId) return fail("That change isn't valid. Refresh the page.");

  try {
    if (!(await regenerateWebhookToken(providerId))) return fail("That provider no longer exists. Refresh the page.");
    await recordAudit(admin, { action: "provider.webhook_token", target: providerId, summary: "Regenerated a provider webhook URL" });
    revalidatePath(WEBHOOKS_PATH);
    return { ok: true, message: "New webhook URL created. Update it on the provider's website." };
  } catch (error) {
    console.error("[webhooks] Could not regenerate token", error);
    return fail("Something went wrong. Try again.");
  }
}
