"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { updateCustomerStatus, type CustomerStatus } from "@/lib/db/customers";

export async function setCustomerStatusAction(id: string, status: CustomerStatus) {
  await requirePermission("customers.manage");
  if (typeof id !== "string" || !id.trim() || (status !== "active" && status !== "suspended")) {
    return { ok: false as const, error: "Invalid customer status request." };
  }

  try {
    const updated = await updateCustomerStatus(id, status);
    if (!updated) return { ok: false as const, error: "Customer not found." };

    revalidatePath("/admin/users/list");
    return { ok: true as const };
  } catch (error) {
    console.error("[customers]", error);
    return { ok: false as const, error: "Something went wrong updating that customer. Try again." };
  }
}
