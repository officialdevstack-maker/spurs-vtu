import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { addMessage, getTicket, setTicketStatus } from "@/lib/db/support";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi(request, "transactions");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const ticket = await getTicket(id, auth.ctx.customerId);
  return ticket ? apiOk(ticket) : apiError("not_found", "Ticket not found.", 404);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi(request, "transactions");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await readJson(request);
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  if (!message || message.length > 3000) return apiError("invalid_request", "Message is required.", 400);
  try {
    await addMessage({ ticketId: id, authorId: auth.ctx.customerId, fromStaff: false, body: message });
    return apiOk({ replied: true });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "NOT_FOUND") return apiError("not_found", "Ticket not found.", 404);
    if (code === "CLOSED") return apiError("conflict", "This ticket is closed.", 409);
    return apiError("server_error", "Could not reply.", 500);
  }
}
