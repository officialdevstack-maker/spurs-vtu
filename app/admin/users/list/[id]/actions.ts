"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/db/audit";
import { setFraudExempt } from "@/lib/db/fraud";
import { adminResetPin } from "@/lib/db/pin";
import { isStaffMember } from "@/lib/db/roles";
import { notify } from "@/lib/notify";

export type CustomerActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): CustomerActionResult => ({ ok: false, error });
const BAD = fail("That change isn't valid. Refresh the page and try again.");

/** Only an owner can change a staff account, matching the suspend rule. */
async function staffBlocked(id: string): Promise<boolean> {
  const { owner } = await getAdminAccess();
  return !owner && (await isStaffMember(id));
}

export async function resetCustomerPin(id: string): Promise<CustomerActionResult> {
  const admin = await requirePermission("customers.manage");
  if (typeof id !== "string" || !id.trim()) return BAD;
  if (await staffBlocked(id)) return fail("Only an owner can reset a staff member's PIN.");

  try {
    if (!(await adminResetPin(id))) return fail("That customer has no PIN to reset.");
    await recordAudit(admin, {
      action: "customer.pin_reset",
      target: id,
      summary: "Reset a customer's transaction PIN",
    });
    await notify(id, {
      id: `pin-${randomUUID()}`,
      category: "security",
      title: "Transaction PIN reset by support",
      body: "Your PIN was removed by Spur VTU support. Set a new one before your next purchase. If you didn't ask for this, contact support.",
    });
    revalidatePath(`/admin/users/list/${id}`);
    return { ok: true };
  } catch (error) {
    console.error("[customer-detail] pin reset", error);
    return fail("Something went wrong. Try again.");
  }
}

export async function setCustomerFraudExempt(id: string, exempt: boolean): Promise<CustomerActionResult> {
  const admin = await requirePermission("customers.manage");
  if (typeof id !== "string" || !id.trim() || typeof exempt !== "boolean") return BAD;
  if (id === admin.sub) return fail("You can't change fraud checks on your own account.");
  if (await staffBlocked(id)) return fail("Only an owner can change this for a staff member.");

  try {
    if (!(await setFraudExempt(id, exempt))) return fail("Customer not found.");
    await recordAudit(admin, {
      action: exempt ? "customer.fraud_exempt" : "customer.fraud_checked",
      target: id,
      summary: exempt ? "Exempted a customer from fraud checks" : "Put a customer back under fraud checks",
    });
    revalidatePath(`/admin/users/list/${id}`);
    return { ok: true };
  } catch (error) {
    console.error("[customer-detail] fraud exempt", error);
    return fail("Something went wrong. Try again.");
  }
}
