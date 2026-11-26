"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { BODY_LIMIT, SUPPORT_PATH } from "@/lib/admin/support";
import { recordAudit } from "@/lib/db/audit";
import * as db from "@/lib/db/support";
import { notifyCustomerOfReply } from "@/lib/support";

export type SupportAdminResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): SupportAdminResult => ({ ok: false, error });

export async function staffReply(ticketId: string, input: unknown): Promise<SupportAdminResult> {
  const admin = await requirePermission("support.manage");
  const body = typeof input === "string" ? input.trim() : "";
  if (typeof ticketId !== "string" || !ticketId) return fail("That change isn't valid. Refresh the page.");
  if (!body || body.length > BODY_LIMIT) return fail(`Write a reply up to ${BODY_LIMIT} characters.`);
  try {
    const sent = await db.addMessage({ ticketId, authorId: admin.sub, fromStaff: true, body });
    await recordAudit(admin, {
      action: "support.reply", target: ticketId,
      summary: `Replied to ticket "${sent.subject}"`, meta: { reopened: sent.previous === "closed" },
    });
    after(() => notifyCustomerOfReply({ customerId: sent.customerId, ticketId, messageId: sent.messageId, subject: sent.subject, body }));
    revalidatePath(`${SUPPORT_PATH}/${ticketId}`);
    revalidatePath(SUPPORT_PATH);
    return { ok: true };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "NOT_FOUND") return fail("That ticket no longer exists. Refresh the page.");
    if (code === "TOO_LONG") return fail("This ticket has too many messages. Close it and ask the customer to open a new one.");
    console.error("[support-admin]", error);
    return fail("Something went wrong. Check the thread before sending again.");
  }
}

export async function staffSetStatus(ticketId: string, status: "open" | "closed"): Promise<SupportAdminResult> {
  const admin = await requirePermission("support.manage");
  if (typeof ticketId !== "string" || !ticketId || (status !== "open" && status !== "closed")) {
    return fail("That change isn't valid. Refresh the page.");
  }
  try {
    if (!(await db.setTicketStatus(ticketId, status, null))) return fail("The ticket already has that status.");
    await recordAudit(admin, {
      action: status === "closed" ? "support.close" : "support.reopen", target: ticketId,
      summary: status === "closed" ? "Closed a support ticket" : "Reopened a support ticket",
    });
    revalidatePath(`${SUPPORT_PATH}/${ticketId}`);
    revalidatePath(SUPPORT_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[support-admin]", error);
    return fail("Something went wrong. Try again.");
  }
}
