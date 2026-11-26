"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { runBalanceCheck } from "@/lib/balance-monitor";
import { setThreshold } from "@/lib/db/balances";
import { recordAudit } from "@/lib/db/audit";

const PATH = "/admin/gateways/balances";
export type BalanceActionResult = { ok: true; message: string } | { ok: false; error: string };
const fail = (error: string): BalanceActionResult => ({ ok: false, error });

export async function saveThreshold(providerId: string, value: unknown): Promise<BalanceActionResult> {
  const admin = await requirePermission("gateways.manage");
  if (typeof providerId !== "string" || !providerId) return fail("That change isn't valid. Refresh the page.");
  const threshold = value === null || value === "" ? null : Number(value);
  if (threshold !== null && (!Number.isFinite(threshold) || threshold < 0 || threshold > 100_000_000)) {
    return fail("Enter a threshold of 0 or more, or leave it empty to turn alerts off.");
  }
  try {
    const rounded = threshold === null ? null : Math.round(threshold * 100) / 100;
    if (!(await setThreshold(providerId, rounded))) return fail("That provider no longer exists. Refresh the page.");
    await recordAudit(admin, {
      action: "provider.balance_threshold",
      target: providerId,
      summary: rounded === null ? "Turned off low-balance alerts" : `Set low-balance threshold to ₦${rounded}`,
      meta: { threshold: rounded },
    });
    revalidatePath(PATH);
    return { ok: true, message: "Saved." };
  } catch (error) {
    console.error("[balances]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}

export async function checkNow(providerId?: string): Promise<BalanceActionResult> {
  await requirePermission("gateways.manage");
  try {
    const report = await runBalanceCheck({ providerId: providerId || undefined, budgetMs: 20_000 });
    revalidatePath(PATH);
    return { ok: true, message: `Checked ${report.checked}: ${report.low} low, ${report.errors} failing.` };
  } catch (error) {
    console.error("[balances]", error);
    return fail("Something went wrong. Try again.");
  }
}
