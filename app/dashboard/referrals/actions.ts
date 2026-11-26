"use server";

import { cookies } from "next/headers";
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
