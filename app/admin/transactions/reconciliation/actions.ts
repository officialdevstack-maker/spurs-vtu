"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/db/audit";
import {
  getOpenItem, markRecharged, resolveItem, type ReconResolution,
} from "@/lib/db/reconciliation";
import { requeryOrder } from "@/lib/reconcile";
import { settleFromWebhook, settleOne } from "@/lib/settlement";
import { debitWallet } from "@/lib/wallet";

const PATH = "/admin/transactions/reconciliation";
export type ReconResult = { ok: true; message: string } | { ok: false; error: string };
const fail = (error: string): ReconResult => ({ ok: false, error });
const note = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function requeryItem(id: string): Promise<ReconResult> {
  const admin = await requirePermission("settings.manage");
  const item = await getOpenItem(id);
  if (!item || !item.providerId) return fail("That item is gone or has no provider.");
  const requery = await requeryOrder(item.providerId, item.transactionId);
  if (requery.outcome === "unknown") return fail("The provider didn't give a clear answer. Try again, or resolve it by hand.");
  if (requery.outcome === "pending") return { ok: true, message: "The provider still says pending." };

  const result = await settleFromWebhook({
    providerId: item.providerId, reference: item.transactionId,
    outcome: requery.outcome, response: requery.response,
  });
  await recordAudit(admin, {
    action: "reconciliation.requery", target: item.transactionId,
    summary: `Requery returned ${requery.outcome} (${result})`, meta: { outcome: requery.outcome, result },
  });
  if (result === "applied") {
    await resolveItem(id, requery.outcome === "success" ? "confirmed_success" : "failed_refunded",
      "Settled by provider requery.", admin.sub);
  }
  revalidatePath(PATH);
  return { ok: true, message: `Requery: ${requery.outcome}, ${result}.` };
}

export async function resolveLateSuccess(id: string, action: "recharge" | "write_off", reason: unknown): Promise<ReconResult> {
  const admin = await requirePermission("settings.manage");
  const text = note(reason);
  if (text.length < 3 || text.length > 200) return fail("Add a reason of 3 to 200 characters.");
  const item = await getOpenItem(id);
  if (!item || item.kind !== "late_success") return fail("That item is gone or already resolved.");

  let resolution: ReconResolution = "written_off";
  try {
    if (action === "recharge") {
      const paid = await debitWallet(item.customerId, item.amount, `${item.transactionId}:recharge`);
      if (!paid) return fail("The customer's wallet can't cover the re-charge. Write it off or try later.");
      await markRecharged(item.transactionId);
      resolution = "recharged";
    }
    if (!(await resolveItem(id, resolution, text, admin.sub))) return fail("Already resolved.");
    await recordAudit(admin, {
      action: `reconciliation.${resolution}`, target: item.transactionId,
      summary: `Late success ${resolution === "recharged" ? "re-charged" : "written off"}: ${text}`,
      meta: { amount: item.amount },
    });
    revalidatePath(PATH);
    revalidatePath("/admin/transactions/list");
    return { ok: true, message: "Resolved." };
  } catch (error) {
    console.error("[reconciliation]", error);
    return fail("Something went wrong. Check the history before trying again.");
  }
}

export async function resolveStuck(id: string, outcome: "success" | "failed", reason: unknown): Promise<ReconResult> {
  const admin = await requirePermission("settings.manage");
  const text = note(reason);
  if (text.length < 3 || text.length > 200) return fail("Add a reason of 3 to 200 characters.");
  const item = await getOpenItem(id);
  if (!item || item.kind !== "stuck_pending") return fail("That item is gone or already resolved.");
  try {
    const result = await settleOne(item.transactionId, outcome, text);
    if (result === "not_pending") {
      await resolveItem(id, outcome === "success" ? "confirmed_success" : "failed_refunded", "Order was already settled.", admin.sub);
      return fail("That order was already settled. Closed the item.");
    }
    await resolveItem(id, outcome === "success" ? "confirmed_success" : "failed_refunded", text, admin.sub);
    await recordAudit(admin, {
      action: `reconciliation.${outcome === "success" ? "confirm_success" : "fail_refund"}`,
      target: item.transactionId, summary: `Stuck order marked ${outcome}: ${text}`,
    });
    revalidatePath(PATH);
    revalidatePath("/admin");
    revalidatePath("/admin/transactions/list");
    return { ok: true, message: "Resolved." };
  } catch (error) {
    console.error("[reconciliation]", error);
    return fail("Something went wrong. Check the history before trying again.");
  }
}
