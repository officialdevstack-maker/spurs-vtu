"use server";

import { revalidatePath } from "next/cache";
import { requireSpursUser } from "@/lib/spurs";
import { markAllNotificationsRead } from "@/lib/db/announcements";

export async function markAllRead(): Promise<{ ok: boolean }> {
  const user = await requireSpursUser();
  try {
    await markAllNotificationsRead(user.sub);
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (error) {
    console.error("[notifications]", error);
    return { ok: false };
  }
}
