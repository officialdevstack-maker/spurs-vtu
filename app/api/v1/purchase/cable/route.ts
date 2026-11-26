import { authenticateApi } from "@/lib/api/auth";
import { apiError, readJson } from "@/lib/api/response";
import { purchaseOptions, purchaseResponse } from "@/lib/api/purchase-response";
import { normalizePhone } from "@/lib/phone";
import { runCablePurchase } from "@/lib/purchase/cable";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "purchase");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  if (!body) return apiError("invalid_request", "Send a JSON body.", 400);
  const { planId, smartcard, phone, reference } = body;
  if (typeof reference !== "string" || typeof planId !== "string" || typeof smartcard !== "string" || typeof phone !== "string") {
    return apiError("invalid_request", "planId, smartcard, phone and reference (a UUID) are required.", 400);
  }
  const { options, extra } = purchaseOptions(auth.ctx, body);
  try {
    const result = await runCablePurchase(
      { sub: auth.ctx.customerId, name: auth.ctx.customerName },
      { planId, smartcard, phone: normalizePhone(phone), reference, ...extra }, options,
    );
    return purchaseResponse(reference, result);
  } catch (error) {
    console.error("[api] cable purchase", reference, error);
    return apiError("server_error", "Something went wrong. Check the order status before retrying.", 500);
  }
}
