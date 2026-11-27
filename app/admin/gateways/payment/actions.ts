"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import * as db from "@/lib/db/payment-providers";
import { recordAudit } from "@/lib/db/audit";

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
  const admin = await requirePermission("gateways.manage");
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
    if (!(await db.saveFlutterwaveProvider(settings))) {
      return fail("No payment provider changes were saved. Refresh the page and try again.");
    }
    revalidatePath("/admin/gateways/payment");
    revalidatePath("/fund-wallet");
    await recordAudit(admin, { action: "payment.flutterwave.save", summary: settings.enabled ? "Saved and enabled Flutterwave" : "Saved and disabled Flutterwave", meta: { enabled: settings.enabled, fieldsChanged: ["publicKey", "secretKey", "webhookHash"] } });
    return { ok: true };
  } catch (error) {
    console.error("[payment-gateway] Failed to save Flutterwave settings", error);
    return fail("Could not save the payment provider. Check the database and encryption key, then try again.");
  }
}

function parsePaymentPointSettings(input: unknown):
  | { apiKey: string; apiSecret: string; businessId: string; webhookSecret: string; enabled: boolean }
  | string {
  if (!input || typeof input !== "object") return "Check the PaymentPoint details and try again.";
  const raw = input as Record<string, unknown>;
  const apiKey = typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";
  const apiSecret = typeof raw.apiSecret === "string" ? raw.apiSecret.trim() : "";
  const businessId = typeof raw.businessId === "string" ? raw.businessId.trim() : "";
  const webhookSecret = typeof raw.webhookSecret === "string" ? raw.webhookSecret.trim() : "";

  if ([apiKey, apiSecret, businessId, webhookSecret].some((value) => value.length > 2000)) {
    return "A PaymentPoint credential is too long. Check the values and try again.";
  }
  if (typeof raw.enabled !== "boolean") return "Choose whether PaymentPoint is enabled.";

  return { apiKey, apiSecret, businessId, webhookSecret, enabled: raw.enabled };
}

export async function savePaymentPointProvider(input: unknown): Promise<PaymentActionResult> {
  const admin = await requirePermission("gateways.manage");
  const settings = parsePaymentPointSettings(input);
  if (typeof settings === "string") return fail(settings);

  try {
    const current = await db.getPaymentPointProviderSettings();
    if (
      !current &&
      (!settings.apiKey || !settings.apiSecret || !settings.businessId)
    ) {
      return fail("Enter the API key, API secret and business ID to add PaymentPoint.");
    }
    if (!(await db.savePaymentPointProvider(settings))) {
      return fail("No PaymentPoint changes were saved. Refresh the page and try again.");
    }
    revalidatePath("/admin/gateways/payment");
    revalidatePath("/fund-wallet");
    await recordAudit(admin, {
      action: "payment.paymentpoint.save",
      summary: settings.enabled ? "Saved and enabled PaymentPoint" : "Saved and disabled PaymentPoint",
      meta: { enabled: settings.enabled, fieldsChanged: ["apiKey", "apiSecret", "businessId", "webhookSecret"] },
    });
    return { ok: true };
  } catch (error) {
    console.error("[payment-gateway] Failed to save PaymentPoint settings", error);
    return fail("Could not save PaymentPoint. Check the database and encryption key, then try again.");
  }
}

export async function deleteFlutterwaveProvider(): Promise<PaymentActionResult> {
  const admin = await requirePermission("gateways.manage");
  try {
    const result = await db.deleteFlutterwaveProvider();
    if (result === "not_found") return fail("Flutterwave is not configured.");
    if (result === "in_use") {
      return fail("Flutterwave cannot be deleted while customer accounts or payment records exist. Disable it instead.");
    }
    revalidatePath("/admin/gateways/payment");
    revalidatePath("/fund-wallet");
    await recordAudit(admin, { action: "payment.flutterwave.delete", summary: "Deleted Flutterwave configuration" });
    return { ok: true };
  } catch (error) {
    console.error("[payment-gateway] Failed to delete Flutterwave settings", error);
    return fail("Could not delete the payment provider. Try again.");
  }
}

export async function deletePaymentPointProvider(): Promise<PaymentActionResult> {
  const admin = await requirePermission("gateways.manage");
  try {
    const result = await db.deletePaymentPointProvider();
    if (result === "not_found") return fail("PaymentPoint is not configured.");
    if (result === "in_use") {
      return fail("PaymentPoint cannot be deleted while customer accounts or payment records exist. Disable it instead.");
    }
    revalidatePath("/admin/gateways/payment");
    revalidatePath("/fund-wallet");
    await recordAudit(admin, { action: "payment.paymentpoint.delete", summary: "Deleted PaymentPoint configuration" });
    return { ok: true };
  } catch (error) {
    console.error("[payment-gateway] Failed to delete PaymentPoint settings", error);
    return fail("Could not delete PaymentPoint settings. Try again.");
  }
}
