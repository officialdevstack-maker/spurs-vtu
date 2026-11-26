"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import {
  FRAUD_PATH, isFraudAction, isRuleId, parseParams,
} from "@/lib/admin/fraud";
import { recordAudit } from "@/lib/db/audit";
import { updateCustomerStatus } from "@/lib/db/customers";
import { reviewFlag, saveRule } from "@/lib/db/fraud";
import { isStaffMember } from "@/lib/db/roles";

export type FraudActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): FraudActionResult => ({ ok: false, error });

export async function saveFraudRule(input: unknown): Promise<FraudActionResult> {
  const admin = await requirePermission("settings.manage");
  if (!input || typeof input !== "object") return fail("Check the rule and try again.");
  const raw = input as Record<string, unknown>;
  if (!isRuleId(raw.rule) || typeof raw.enabled !== "boolean" || !isFraudAction(raw.action)) {
    return fail("Check the rule and try again.");
  }
  const params = parseParams(raw.rule, raw.params);
  if (typeof params === "string") return fail(params);
  try {
    if (!(await saveRule(raw.rule, raw.enabled, raw.action, params))) return fail("That rule no longer exists. Refresh the page.");
    await recordAudit(admin, {
      action: "fraud.rule.save", target: raw.rule,
      summary: `Updated fraud rule ${raw.rule}`, meta: { enabled: raw.enabled, action: raw.action, params },
    });
    revalidatePath(FRAUD_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[fraud]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}

export async function reviewFraudFlag(
  id: string,
  resolution: "dismissed" | "confirmed",
  note: unknown,
  suspend = false,
): Promise<FraudActionResult> {
  const admin = await requirePermission("customers.manage");
  const text = typeof note === "string" ? note.trim() : "";
  if (typeof id !== "string" || !id || (resolution !== "dismissed" && resolution !== "confirmed")) {
    return fail("That change isn't valid. Refresh the page.");
  }
  if (text.length < 3 || text.length > 200) return fail("Add a note of 3 to 200 characters.");

  try {
    let customerId: string | null = null;
    if (suspend && resolution === "confirmed") {
      const { owner } = await getAdminAccess();
      customerId = await reviewFlag(id, resolution, text, admin.sub);
      if (!customerId) return fail("That flag was already reviewed.");
      if (customerId === admin.sub) return fail("You can't suspend your own account.");
      if (!owner && (await isStaffMember(customerId))) return fail("Only an owner can suspend a staff account.");
      await updateCustomerStatus(customerId, "suspended");
      await recordAudit(admin, { action: "customer.suspend", target: customerId, summary: "Suspended a customer after a fraud review" });
      await recordAudit(admin, { action: "fraud.flag.confirmed", target: id, summary: `Fraud flag confirmed: ${text}`, meta: { suspended: true } });
    } else {
      customerId = await reviewFlag(id, resolution, text, admin.sub);
      if (!customerId) return fail("That flag was already reviewed.");
      await recordAudit(admin, { action: `fraud.flag.${resolution}`, target: id, summary: `Fraud flag ${resolution}: ${text}` });
    }
    revalidatePath(FRAUD_PATH);
    revalidatePath("/admin/users/list");
    if (customerId) revalidatePath(`/admin/users/list/${customerId}`);
    return { ok: true };
  } catch (error) {
    console.error("[fraud]", error);
    return fail("Something went wrong. Check the flag list before trying again.");
  }
}
