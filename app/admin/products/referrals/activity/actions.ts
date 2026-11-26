"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { REFERRAL_ACTIVITY_PATH } from "@/lib/admin/referrals";
import { revokePendingReferral } from "@/lib/db/referrals";
import { recordAudit } from "@/lib/db/audit";

export async function revokeReferral(refereeId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requirePermission("products.manage");
  if (typeof refereeId !== "string" || !refereeId) return { ok: false, error: "That change isn't valid." };
  try {
    if (!(await revokePendingReferral(refereeId))) return { ok: false, error: "That referral is already rewarded or gone." };
    await recordAudit(admin, { action: "referral.revoke", target: refereeId, summary: "Revoked a pending referral" });
    revalidatePath(REFERRAL_ACTIVITY_PATH);
    revalidatePath("/dashboard/referrals");
    return { ok: true };
  } catch (error) {
    console.error("[referrals-admin]", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
