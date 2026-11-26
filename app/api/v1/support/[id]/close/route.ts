import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { setTicketStatus } from "@/lib/db/support";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi(request, "transactions");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  return await setTicketStatus(id, "closed", auth.ctx.customerId)
    ? apiOk({ closed: true })
    : apiError("not_found", "Ticket not found or already closed.", 404);
}
