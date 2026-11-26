"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { REFERRAL_CODE } from "@/lib/admin/referrals";
import { recordReferral } from "@/lib/db/referrals";
import { requireSpursUser } from "@/lib/spurs";

export async function claimReferral(): Promise<void> {
  const user = await requireSpursUser();
  const jar = await cookies();
  const code = jar.get("ref")?.value;
  if (!code) return;
  try {
    if (REFERRAL_CODE.test(code)) await recordReferral(user.sub, code);
  } catch (error) {
    console.error("[referrals] Could not record referral", error);
  }
  jar.delete("ref");
}

export async function applyReferralCode(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireSpursUser();
  const code = typeof input === "string" ? input.trim().toUpperCase() : "";
  if (!REFERRAL_CODE.test(code)) return { ok: false, error: "Codes are 8 letters and numbers." };
  try {
    if (!(await recordReferral(user.sub, code))) {
      return {
        ok: false,
        error: "That code can't be used on this account. It must belong to someone else, and only works before your first purchase in your first 7 days.",
      };
    }
    revalidatePath("/dashboard/referrals");
    return { ok: true };
  } catch (error) {
    console.error("[referrals] Could not apply code", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
