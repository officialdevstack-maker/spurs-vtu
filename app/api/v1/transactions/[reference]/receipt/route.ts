import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getReceipt } from "@/lib/db/receipts";
import { receiptUrls, signReceiptToken } from "@/lib/receipt";

export async function GET(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const auth = await authenticateApi(request, "transactions");
  if (!auth.ok) return auth.response;
  const { reference } = await params;
  const receipt = await getReceipt(reference, auth.ctx.customerId);
  if (!receipt) return apiError("not_found", "Receipt not found.", 404);
  return apiOk(receipt);
}

export async function POST(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const auth = await authenticateApi(request, "transactions");
  if (!auth.ok) return auth.response;
  const { reference } = await params;
  const receipt = await getReceipt(reference, auth.ctx.customerId);
  if (!receipt || receipt.status !== "success" || receipt.direction !== "debit") {
    return apiError("invalid_request", "Only successful purchases can be shared.", 422);
  }
  return apiOk(receiptUrls(signReceiptToken(reference)));
}
