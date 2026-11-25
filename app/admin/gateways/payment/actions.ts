"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import * as db from "@/lib/db/payment-providers";

export type PaymentActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): PaymentActionResult => ({ ok: false, error });

function parseSettings(input: unknown):
  | { publicKey: string; secretKey: string; webhookHash: string; enabled: boolean }
  | string {
  if (!input || typeof input !== "object") return "Check the payment provider details and try again.";
  const raw = input as Record<string, unknown>;
  const publicKey = typeof raw.publicKey === "string" ? raw.publicKey.trim() : "";
  const secretKey = typeof raw.secretKey === "string" ? raw.secretKey.trim() : "";
  const webhookHash = typeof raw.webhookHash === "string" ? raw.webhookHash.trim() : "";

  if (publicKey.length > 1000 || secretKey.length > 2000 || webhookHash.length > 2000) {
    return "A credential is too long. Check the values and try again.";
  }
  if (typeof raw.enabled !== "boolean") return "Choose whether Flutterwave is enabled.";

  return { publicKey, secretKey, webhookHash, enabled: raw.enabled };
}

export async function saveFlutterwaveProvider(input: unknown): Promise<PaymentActionResult> {
  await requirePermission("gateways.manage");
  const settings = parseSettings(input);
  if (typeof settings === "string") return fail(settings);

  try {
    const current = await db.getPaymentProviderSettings();
    if (
      !current &&
      (!settings.publicKey || !settings.secretKey || !settings.webhookHash)
    ) {
      return fail("Enter the public key, secret key and webhook hash to add Flutterwave.");
    }
    await db.saveFlutterwaveProvider(settings);
    revalidatePath("/admin/gateways/payment");
    revalidatePath("/fund-wallet");
    return { ok: true };
  } catch (error) {
    console.error("[payment-gateway] Failed to save Flutterwave settings", error);
    return fail("Could not save the payment provider. Check the database and encryption key, then try again.");
  }
}

export async function deleteFlutterwaveProvider(): Promise<PaymentActionResult> {
  await requirePermission("gateways.manage");
  try {
    const result = await db.deleteFlutterwaveProvider();
    if (result === "not_found") return fail("Flutterwave is not configured.");
    if (result === "in_use") {
      return fail("Flutterwave cannot be deleted while customer accounts or payment records exist. Disable it instead.");
    }
    revalidatePath("/admin/gateways/payment");
    revalidatePath("/fund-wallet");
    return { ok: true };
  } catch (error) {
    console.error("[payment-gateway] Failed to delete Flutterwave settings", error);
    return fail("Could not delete the payment provider. Try again.");
  }
}
