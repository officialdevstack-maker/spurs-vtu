import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { findTransaction } from "@/lib/db/transactions";
import { REFERENCE } from "@/lib/purchase/execute";

export async function GET(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const auth = await authenticateApi(request, "transactions");
  if (!auth.ok) return auth.response;
  const { reference } = await params;
  if (!REFERENCE.test(reference) && !/^flw-\d+$/.test(reference)) {
    return apiError("invalid_request", "That reference isn't valid.", 400);
  }
  try {
    const tx = await findTransaction(reference, auth.ctx.customerId);
    if (!tx) return apiError("not_found", "No order with that reference.", 404);
    return apiOk({
      reference,
      status: tx.status,
      title: tx.title,
      failureReason: tx.status === "failed" ? tx.failureReason : null,
    });
  } catch (error) {
    console.error("[api] transaction lookup", error);
    return apiError("server_error", "Something went wrong. Try again.", 500);
  }
}
