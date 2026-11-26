import { authenticateApi } from "@/lib/api/auth";
import { apiError, readJson } from "@/lib/api/response";
import { purchaseOptions, purchaseResponse } from "@/lib/api/purchase-response";
import { normalizePhone } from "@/lib/phone";
import { runAirtimePurchase } from "@/lib/purchase/airtime";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "purchase");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  if (!body) return apiError("invalid_request", "Send a JSON body.", 400);
  const { networkId, typeId, amount, phone, reference } = body;
  if (typeof reference !== "string" || typeof phone !== "string") {
    return apiError("invalid_request", "networkId, typeId, amount, phone and reference (a UUID) are required.", 400);
  }
  const { options, extra } = purchaseOptions(auth.ctx, body);
  try {
    const result = await runAirtimePurchase(
      { sub: auth.ctx.customerId, name: auth.ctx.customerName },
      { networkId, typeId, amount, phone: normalizePhone(phone), reference, ...extra },
      options,
    );
    return purchaseResponse(reference, result);
  } catch (error) {
    console.error("[api] airtime purchase", reference, error);
    return apiError("server_error", "Something went wrong. Check the order status before retrying.", 500);
  }
}
