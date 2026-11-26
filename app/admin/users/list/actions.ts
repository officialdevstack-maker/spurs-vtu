"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { updateCustomerStatus, type CustomerStatus } from "@/lib/db/customers";
import { isStaffMember } from "@/lib/db/roles";
import { recordAudit } from "@/lib/db/audit";

export async function setCustomerStatusAction(id: string, status: CustomerStatus) {
  const user = await requirePermission("customers.manage");
  if (typeof id !== "string" || !id.trim() || (status !== "active" && status !== "suspended")) {
    return { ok: false as const, error: "Invalid customer status request." };
  }

  if (status === "suspended") {
    if (id === user.sub) return { ok: false as const, error: "You can't suspend your own account." };
    const { owner } = await getAdminAccess();
    if (!owner && (await isStaffMember(id))) {
      return { ok: false as const, error: "Only an owner can suspend a staff account." };
    }
  }

  try {
    const updated = await updateCustomerStatus(id, status);
    if (!updated) return { ok: false as const, error: "Customer not found." };
    await recordAudit(user, {
      action: status === "suspended" ? "customer.suspend" : "customer.reactivate",
      target: id,
      summary: status === "suspended" ? "Suspended a customer" : "Reactivated a customer",
    });

    revalidatePath("/admin/users/list");
    return { ok: true as const };
  } catch (error) {
    console.error("[customers]", error);
    return { ok: false as const, error: "Something went wrong updating that customer. Try again." };
  }
}
