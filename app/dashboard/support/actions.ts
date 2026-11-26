"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { BODY_LIMIT, CUSTOMER_SUPPORT_PATH, SUBJECT_LIMIT } from "@/lib/admin/support";
import * as db from "@/lib/db/support";
import { notifyStaff } from "@/lib/support";
import { requireSpursUser } from "@/lib/spurs";

export type SupportResult = { ok: true; id?: string } | { ok: false; error: string };
const fail = (error: string): SupportResult => ({ ok: false, error });
const BAD = fail("Check your message and try again.");
const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/[ \t]+/g, " ") : "");
const label = (u: { name?: string | null; username?: string | null }) =>
  u.username ? `@${u.username}` : (u.name ?? "A customer");

function errorFor(error: unknown): SupportResult {
  const code = (error as { code?: string } | null)?.code;
  if (code === "TOO_MANY") return fail("You have several open tickets. Wait for a reply or close one first.");
  if (code === "BAD_TRANSACTION") return fail("We couldn't find that purchase. Pick another or leave it empty.");
  if (code === "CLOSED") return fail("This ticket is closed. Open a new ticket if you still need help.");
  if (code === "TOO_LONG") return fail("This ticket has too many messages. Open a new ticket.");
  if (code === "NOT_FOUND") return fail("That ticket no longer exists. Refresh the page.");
  console.error("[support]", error);
  return fail("Something went wrong. Try again.");
}

export async function createTicket(input: unknown): Promise<SupportResult> {
  const user = await requireSpursUser();
  if (!input || typeof input !== "object") return BAD;
  const raw = input as Record<string, unknown>;
  const subject = clean(raw.subject);
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const transactionId = typeof raw.transactionId === "string" && raw.transactionId ? raw.transactionId.slice(0, 100) : null;
  if (!subject || subject.length > SUBJECT_LIMIT) return fail(`Enter a subject up to ${SUBJECT_LIMIT} characters.`);
  if (!body || body.length > BODY_LIMIT) return fail(`Write a message up to ${BODY_LIMIT} characters.`);

  try {
    const { ticketId, messageId } = await db.createTicket({ customerId: user.sub, subject, body, transactionId });
    after(() => notifyStaff({ ticketId, messageId, authorId: user.sub, title: "New support ticket", subject, from: label(user) }));
    revalidatePath(CUSTOMER_SUPPORT_PATH);
    return { ok: true, id: ticketId };
  } catch (error) {
    return errorFor(error);
  }
}

export async function replyToTicket(ticketId: string, input: unknown): Promise<SupportResult> {
  const user = await requireSpursUser();
  const body = typeof input === "string" ? input.trim() : "";
  if (typeof ticketId !== "string" || !ticketId) return BAD;
  if (!body || body.length > BODY_LIMIT) return fail(`Write a message up to ${BODY_LIMIT} characters.`);

  try {
    const sent = await db.addMessage({ ticketId, authorId: user.sub, fromStaff: false, body });
    if (sent.previous !== "open") {
      after(() => notifyStaff({
        ticketId, messageId: sent.messageId, authorId: user.sub,
        title: "Customer replied", subject: sent.subject, from: label(user),
      }));
    }
    revalidatePath(`${CUSTOMER_SUPPORT_PATH}/${ticketId}`);
    return { ok: true };
  } catch (error) {
    return errorFor(error);
  }
}

export async function closeMyTicket(ticketId: string): Promise<SupportResult> {
  const user = await requireSpursUser();
  if (typeof ticketId !== "string" || !ticketId) return BAD;
  try {
    if (!(await db.setTicketStatus(ticketId, "closed", user.sub))) return fail("That ticket is already closed.");
    revalidatePath(CUSTOMER_SUPPORT_PATH);
    revalidatePath(`${CUSTOMER_SUPPORT_PATH}/${ticketId}`);
    return { ok: true };
  } catch (error) {
    return errorFor(error);
  }
}
