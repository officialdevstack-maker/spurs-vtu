"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { CASHBACK_ACTIVITY_PATH } from "@/lib/admin/cashback";
import { changeCashbackBalance } from "@/lib/db/cashback";
import { findCustomerByIdentifier } from "@/lib/db/customers";
import { recordAudit } from "@/lib/db/audit";

export type AdjustResult = { ok: true; message: string } | { ok: false; error: string };
const fail = (error: string): AdjustResult => ({ ok: false, error });

export async function adjustCashback(input: unknown): Promise<AdjustResult> {
  const admin = await requirePermission("settings.manage");
  if (!input || typeof input !== "object") return fail("Check the details and try again.");
  const raw = input as Record<string, unknown>;

  const who = typeof raw.customer === "string" ? raw.customer.trim() : "";
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  const amount = raw.amount;
  if (who.length < 2 || who.length > 100) return fail("Enter a username, email, phone number or Spurs ID.");
  if (raw.direction !== "credit" && raw.direction !== "debit") return fail("Choose add or remove.");
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    return fail("Enter an amount from ₦0.01 to ₦100,000.");
  }
  const amountKobo = Math.round(amount * 100);
  if (Math.abs(amount * 100 - amountKobo) > 1e-6) return fail("Use at most two decimal places.");
  if (note.length < 3 || note.length > 200) return fail("Add a reason of 3 to 200 characters.");

  try {
    const customer = await findCustomerByIdentifier(who);
    if (!customer) return fail("No customer found. They need to log in to Spur VTU once first.");
    const done = await changeCashbackBalance({
      customerId: customer.id,
      amountKobo,
      reference: `adjust:${randomUUID()}`,
      direction: raw.direction,
      source: "adjust",
      note,
      createdBy: admin.sub,
    });
    if (!done) return fail("That customer doesn't have enough cashback to remove.");
    await recordAudit(admin, {
      action: "cashback.adjust",
      target: customer.id,
      summary: `${raw.direction === "credit" ? "Added" : "Removed"} ₦${amount.toFixed(2)} cashback: ${note}`,
      meta: { amount, direction: raw.direction, note },
    });
    revalidatePath(CASHBACK_ACTIVITY_PATH);
    revalidatePath("/dashboard/bonus");
    return { ok: true, message: `Done for ${customer.username ? `@${customer.username}` : (customer.name ?? "customer")}.` };
  } catch (error) {
    console.error("[cashback-adjust]", error);
    return fail("Something went wrong. Check the activity list before trying again.");
  }
}
