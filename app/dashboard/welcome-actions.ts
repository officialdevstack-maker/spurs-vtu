"use server";

import { requireSpursUser } from "@/lib/spurs";
import { markWelcomeSeen as saveSeen } from "@/lib/db/announcements";

export async function markWelcomeSeen(version: number): Promise<void> {
  const user = await requireSpursUser();
  if (!Number.isSafeInteger(version) || version < 1) return;
  try {
    await saveSeen(user.sub, version);
  } catch (error) {
    console.error("[welcome] Could not mark as seen", error);
  }
}
