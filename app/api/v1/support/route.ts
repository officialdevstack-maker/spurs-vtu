import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { createTicket, listCustomerTickets } from "@/lib/db/support";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "transactions");
  if (!auth.ok) return auth.response;
  return apiOk({ items: await listCustomerTickets(auth.ctx.customerId, 50) });
}

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "transactions");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  if (!subject || subject.length > 120 || !message || message.length > 3000) {
    return apiError("invalid_request", "Subject and message are required.", 400);
  }
  try {
    const transactionId = typeof body?.transactionId === "string" ? body.transactionId : null;
    const result = await createTicket({ customerId: auth.ctx.customerId, subject, body: message, transactionId });
    return apiOk({ id: result.ticketId }, 201);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "TOO_MANY") return apiError("conflict", "Close an open ticket before opening another.", 409);
    if (code === "BAD_TRANSACTION") return apiError("invalid_request", "That transaction was not found.", 400);
    console.error("[api] support create", error);
    return apiError("server_error", "Could not create the ticket.", 500);
  }
}
