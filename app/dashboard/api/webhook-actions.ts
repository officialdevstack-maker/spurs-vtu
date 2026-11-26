"use server";

import { revalidatePath } from "next/cache";
import { API_PACKAGE_ID, API_PATH } from "@/lib/api/keys";
import { WebhookUrlError, assertPublicUrl, generateWebhookSecret } from "@/lib/api/webhooks";
import { encryptSecret } from "@/lib/crypto";
import * as db from "@/lib/db/api-webhooks";
import { recordAudit } from "@/lib/db/audit";
import { getCustomerPackage } from "@/lib/db/packages";
import { requireSpursUser } from "@/lib/spurs";

export type WebhookResult = { ok: true; secret?: string } | { ok: false; error: string };
const fail = (error: string): WebhookResult => ({ ok: false, error });
const WRONG = fail("Something went wrong. Try again.");

async function eligibleUser() {
  const user = await requireSpursUser();
  const pkg = await getCustomerPackage(user.sub);
  return pkg?.id === API_PACKAGE_ID ? user : null;
}

export async function saveWebhook(input: unknown): Promise<WebhookResult> {
  const user = await eligibleUser();
  if (!user) return fail("Webhooks are available on the API package.");
  if (!input || typeof input !== "object") return fail("Check the details and try again.");
  const raw = input as Record<string, unknown>;
  if (typeof raw.url !== "string" || raw.url.length > 500 || typeof raw.enabled !== "boolean") {
    return fail("Check the details and try again.");
  }
  try {
    const url = (await assertPublicUrl(raw.url)).toString();
    const existing = await db.getApiWebhook(user.sub);
    let secret: string | undefined;
    if (!existing) {
      secret = generateWebhookSecret();
      if (!(await db.createApiWebhook(user.sub, url, encryptSecret(secret)))) return WRONG;
    } else if (!(await db.updateApiWebhook(user.sub, url, raw.enabled))) {
      return WRONG;
    }
    await recordAudit(user, {
      action: "api_webhook.save", target: user.sub,
      summary: existing ? "Updated the order webhook" : "Created the order webhook",
      meta: { enabled: existing ? raw.enabled : true },
    });
    revalidatePath(API_PATH);
    return { ok: true, secret };
  } catch (error) {
    if (error instanceof WebhookUrlError) return fail(error.message);
    console.error("[api-webhooks] save", error);
    return WRONG;
  }
}

export async function rotateWebhookSecret(): Promise<WebhookResult> {
  const user = await eligibleUser();
  if (!user) return fail("Webhooks are available on the API package.");
  try {
    const secret = generateWebhookSecret();
    if (!(await db.setApiWebhookSecret(user.sub, encryptSecret(secret)))) return fail("Add a webhook address first.");
    await recordAudit(user, { action: "api_webhook.rotate", target: user.sub, summary: "Rotated the webhook secret" });
    revalidatePath(API_PATH);
    return { ok: true, secret };
  } catch (error) {
    console.error("[api-webhooks] rotate", error);
    return WRONG;
  }
}

export async function removeWebhook(): Promise<WebhookResult> {
  const user = await eligibleUser();
  if (!user) return fail("Webhooks are available on the API package.");
  try {
    await db.deleteApiWebhook(user.sub);
    await recordAudit(user, { action: "api_webhook.delete", target: user.sub, summary: "Removed the order webhook" });
    revalidatePath(API_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[api-webhooks] delete", error);
    return WRONG;
  }
}
