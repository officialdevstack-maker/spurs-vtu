"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { customerUrl } from "@/lib/admin/customer-detail";
import { changeCashbackBalance } from "@/lib/db/cashback";
import { customerExists, setFraudExempt } from "@/lib/db/customer-detail";
import { recordAudit } from "@/lib/db/audit";
import { changeCustomerPackage, getCustomerPackage, getPackage } from "@/lib/db/packages";
import { adminResetPin } from "@/lib/db/pin";
import { changeWalletBalance } from "@/lib/db/wallet";
import { formatNaira } from "@/lib/format";
import { notify } from "@/lib/notify";

export type CustomerActionResult = { ok: true; message: string } | { ok: false; error: string };

const fail = (error: string): CustomerActionResult => ({ ok: false, error });
const BAD = fail("That change isn't valid. Refresh the page and try again.");
const GONE = fail("That customer no longer exists. Refresh the page.");
const SOMETHING = fail("Something went wrong. Check the activity list before trying again.");

function refresh(id: string) {
  revalidatePath(customerUrl(id));
  revalidatePath("/admin/users/list");
}

type Adjustment = { amountKobo: number; direction: "credit" | "debit"; note: string };

function parseAdjustment(input: unknown): Adjustment | string {
  if (!input || typeof input !== "object") return "Check the details and try again.";
  const raw = input as Record<string, unknown>;
  if (raw.direction !== "credit" && raw.direction !== "debit") return "Choose add or remove.";
  const amount = raw.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return "Enter an amount from ₦0.01 to ₦1,000,000.";
  }
  const amountKobo = Math.round(amount * 100);
  if (Math.abs(amount * 100 - amountKobo) > 1e-6) return "Use at most two decimal places.";
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  if (note.length < 3 || note.length > 200) return "Add a reason of 3 to 200 characters.";
  return { amountKobo, direction: raw.direction, note };
}

export async function adjustWallet(customerId: string, input: unknown): Promise<CustomerActionResult> {
  const admin = await requirePermission("settings.manage");
  if (typeof customerId !== "string" || !customerId) return BAD;
  if (customerId === admin.sub) return fail("You can't adjust your own wallet.");
  const adjustment = parseAdjustment(input);
  if (typeof adjustment === "string") return fail(adjustment);
  try {
    if (!(await customerExists(customerId))) return GONE;
    const done = await changeWalletBalance({
      customerId,
      amountKobo: adjustment.amountKobo,
      reference: `adjust:${randomUUID()}`,
      direction: adjustment.direction,
      source: "adjust",
    });
    if (!done) return fail("That customer's wallet doesn't have enough to remove that amount.");
    const naira = adjustment.amountKobo / 100;
    await recordAudit(admin, {
      action: "wallet.adjust",
      target: customerId,
      summary: `${adjustment.direction === "credit" ? "Added" : "Removed"} ${formatNaira(naira)} ${adjustment.direction === "credit" ? "to" : "from"} wallet: ${adjustment.note}`,
      meta: { amount: naira, direction: adjustment.direction, note: adjustment.note },
    });
    refresh(customerId);
    return { ok: true, message: "Wallet updated." };
  } catch (error) {
    console.error("[customer-wallet-adjust]", error);
    return SOMETHING;
  }
}

export async function adjustCustomerCashback(customerId: string, input: unknown): Promise<CustomerActionResult> {
  const admin = await requirePermission("settings.manage");
  if (typeof customerId !== "string" || !customerId) return BAD;
  const adjustment = parseAdjustment(input);
  if (typeof adjustment === "string") return fail(adjustment);
  try {
    if (!(await customerExists(customerId))) return GONE;
    const done = await changeCashbackBalance({
      customerId,
      amountKobo: adjustment.amountKobo,
      reference: `adjust:${randomUUID()}`,
      direction: adjustment.direction,
      source: "adjust",
      note: adjustment.note,
      createdBy: admin.sub,
    });
    if (!done) return fail("That customer doesn't have enough cashback to remove.");
    const naira = adjustment.amountKobo / 100;
    await recordAudit(admin, {
      action: "cashback.adjust",
      target: customerId,
      summary: `${adjustment.direction === "credit" ? "Added" : "Removed"} ${formatNaira(naira)} cashback: ${adjustment.note}`,
      meta: { amount: naira, direction: adjustment.direction, note: adjustment.note },
    });
    refresh(customerId);
    return { ok: true, message: "Cashback updated." };
  } catch (error) {
    console.error("[customer-cashback-adjust]", error);
    return SOMETHING;
  }
}

export async function resetCustomerPin(customerId: string): Promise<CustomerActionResult> {
  const admin = await requirePermission("customers.manage");
  if (typeof customerId !== "string" || !customerId) return BAD;
  try {
    if (!(await adminResetPin(customerId))) return fail("This customer has no PIN record to reset.");
    await recordAudit(admin, { action: "pin.admin_reset", target: customerId, summary: "Reset a customer's transaction PIN" });
    await notify(customerId, {
      id: `pin-admin-${randomUUID()}`,
      category: "security",
      title: "Transaction PIN reset by support",
      body: "Support reset your transaction PIN. You'll be asked to set a new one. If you didn't ask for this, contact support.",
    });
    refresh(customerId);
    return { ok: true, message: "PIN cleared. The customer will set a new one." };
  } catch (error) {
    console.error("[customer-pin-reset]", error);
    return SOMETHING;
  }
}

export async function toggleFraudExempt(customerId: string, exempt: boolean): Promise<CustomerActionResult> {
  const admin = await requirePermission("settings.manage");
  if (typeof customerId !== "string" || !customerId || typeof exempt !== "boolean") return BAD;
  try {
    if (!(await setFraudExempt(customerId, exempt))) return GONE;
    await recordAudit(admin, {
      action: "customer.fraud_exempt",
      target: customerId,
      summary: exempt ? "Exempted a customer from fraud checks" : "Removed a customer's fraud exemption",
      meta: { exempt },
    });
    refresh(customerId);
    return { ok: true, message: exempt ? "Fraud checks are now skipped." : "Fraud checks apply again." };
  } catch (error) {
    console.error("[customer-fraud-exempt]", error);
    return SOMETHING;
  }
}

export async function changePackageForCustomer(customerId: string, packageId: string): Promise<CustomerActionResult> {
  const admin = await requirePermission("customers.manage");
  if (typeof customerId !== "string" || !customerId || typeof packageId !== "string" || !packageId) return BAD;
  try {
    const [current, target] = await Promise.all([getCustomerPackage(customerId), getPackage(packageId)]);
    if (!current || !target) return fail("That package no longer exists. Refresh the page.");
    if (current.id === target.id) return fail("The customer is already on that package.");
    if (!(await changeCustomerPackage(customerId, current.id, target.id, 0))) {
      return fail("The customer's package changed. Refresh the page.");
    }
    await recordAudit(admin, {
      action: "customer.package",
      target: customerId,
      summary: `Moved a customer from ${current.name} to ${target.name} (no fee)`,
      meta: { from: current.id, to: target.id },
    });
    refresh(customerId);
    return { ok: true, message: `Moved to ${target.name}.` };
  } catch (error) {
    console.error("[customer-package]", error);
    return SOMETHING;
  }
}
