"use server";

import { headers } from "next/headers";
import { removeSubscription, saveSubscription } from "@/lib/db/push";
import { requireSpursUser } from "@/lib/spurs";

export type PushResult = { ok: true } | { ok: false; error: string };

export async function subscribePush(input: unknown): Promise<PushResult> {
  const user = await requireSpursUser();
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const { endpoint, p256dh, auth } = raw;
  if (
    typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000 ||
    typeof p256dh !== "string" || p256dh.length < 20 || p256dh.length > 200 ||
    typeof auth !== "string" || auth.length < 10 || auth.length > 100
  ) {
    return { ok: false, error: "This device sent an invalid subscription. Try again." };
  }
  try {
    await saveSubscription(user.sub, { endpoint, p256dh, auth }, (await headers()).get("user-agent"));
    return { ok: true };
  } catch (error) {
    console.error("[push] subscribe", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function unsubscribePush(endpoint: unknown): Promise<PushResult> {
  const user = await requireSpursUser();
  if (typeof endpoint !== "string" || !endpoint) return { ok: false, error: "Something went wrong. Try again." };
  try {
    await removeSubscription(user.sub, endpoint);
    return { ok: true };
  } catch (error) {
    console.error("[push] unsubscribe", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
