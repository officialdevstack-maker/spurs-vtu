"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { CASHBACK_PATH, CASHBACK_SERVICES, MAX_CASHBACK_PERCENT, type CashbackRule, type CashbackSettings } from "@/lib/admin/cashback";
import { saveCashbackSettings } from "@/lib/db/cashback";
import { recordAudit } from "@/lib/db/audit";

export type CashbackActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): CashbackActionResult => ({ ok: false, error });
const round2 = (v: number) => Math.round(v * 100) / 100;

export async function saveCashback(input: CashbackSettings): Promise<CashbackActionResult> {
  const admin = await requirePermission("products.manage");
  if (!input || typeof input !== "object" || typeof input.enabled !== "boolean" || !Array.isArray(input.rules)) {
    return fail("Check the cashback settings and try again.");
  }

  const seen = new Set<string>();
  const rules: CashbackRule[] = [];
  for (const raw of input.rules) {
    const service = CASHBACK_SERVICES.find((s) => s.id === raw?.service);
    if (!service || seen.has(service.id)) return fail("Check the cashback settings and try again.");
    seen.add(service.id);
    if (typeof raw.enabled !== "boolean") return fail("Check the cashback settings and try again.");
    if (!Number.isFinite(raw.percent) || raw.percent < 0 || raw.percent > MAX_CASHBACK_PERCENT) {
      return fail(`${service.label}: the percentage must be from 0 to ${MAX_CASHBACK_PERCENT}.`);
    }
    if (!Number.isFinite(raw.minSpend) || raw.minSpend < 0 || raw.minSpend > 10_000_000) {
      return fail(`${service.label}: enter a minimum spend of 0 or more.`);
    }
    if (raw.monthlyCap !== null && (!Number.isFinite(raw.monthlyCap) || raw.monthlyCap <= 0 || raw.monthlyCap > 10_000_000)) {
      return fail(`${service.label}: the monthly cap must be above 0, or left empty for no cap.`);
    }
    rules.push({
      service: service.id,
      enabled: raw.enabled,
      percent: round2(raw.percent),
      minSpend: round2(raw.minSpend),
      monthlyCap: raw.monthlyCap === null ? null : round2(raw.monthlyCap),
    });
  }
  if (rules.length !== CASHBACK_SERVICES.length) return fail("Check the cashback settings and try again.");

  try {
    await saveCashbackSettings({ enabled: input.enabled, rules });
    await recordAudit(admin, { action: "cashback.settings", summary: input.enabled ? "Enabled cashback settings" : "Disabled cashback", meta: { enabled: input.enabled, ruleCount: rules.length } });
    revalidatePath(CASHBACK_PATH);
    revalidatePath("/dashboard/bonus");
    return { ok: true };
  } catch (error) {
    console.error("[cashback]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}
