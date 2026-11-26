"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { REFERRALS_PATH, type ReferralSettings } from "@/lib/admin/referrals";
import { saveReferralSettings } from "@/lib/db/referrals";
import { recordAudit } from "@/lib/db/audit";

export type ReferralActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ReferralActionResult => ({ ok: false, error });
const money = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
const round2 = (value: number) => Math.round(value * 100) / 100;

export async function saveReferrals(input: ReferralSettings): Promise<ReferralActionResult> {
  const admin = await requirePermission("products.manage");
  if (!input || typeof input !== "object" || typeof input.enabled !== "boolean") {
    return fail("Check the referral settings and try again.");
  }
  if (!money(input.referrerReward, 10_000)) return fail("The referrer reward must be from ₦0 to ₦10,000.");
  if (!money(input.refereeReward, 10_000)) return fail("The welcome reward must be from ₦0 to ₦10,000.");
  if (!money(input.minPurchase, 10_000_000)) return fail("Enter a minimum purchase of 0 or more.");
  if (!Number.isInteger(input.monthlyLimit) || input.monthlyLimit < 0 || input.monthlyLimit > 1000) {
    return fail("The monthly limit must be a whole number from 0 to 1,000.");
  }

  try {
    await saveReferralSettings({
      enabled: input.enabled,
      referrerReward: round2(input.referrerReward),
      refereeReward: round2(input.refereeReward),
      minPurchase: round2(input.minPurchase),
      monthlyLimit: input.monthlyLimit,
    });
    await recordAudit(admin, { action: "referral.settings", summary: input.enabled ? "Updated referral settings" : "Disabled referrals", meta: { enabled: input.enabled, referrerReward: input.referrerReward, refereeReward: input.refereeReward, minPurchase: input.minPurchase, monthlyLimit: input.monthlyLimit } });
    revalidatePath(REFERRALS_PATH);
    revalidatePath("/dashboard/referrals");
    return { ok: true };
  } catch (error) {
    console.error("[referrals]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}
