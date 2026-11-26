import { authenticateApi } from "@/lib/api/auth";
import { apiError, readJson } from "@/lib/api/response";
import { purchaseOptions, purchaseResponse } from "@/lib/api/purchase-response";
import { normalizePhone } from "@/lib/phone";
import { runElectricityPurchase } from "@/lib/purchase/electricity";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "purchase");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  if (!body) return apiError("invalid_request", "Send a JSON body.", 400);
  const { discoId, meterType, meter, amount, phone, reference } = body;
  if (typeof reference !== "string" || typeof phone !== "string") {
    return apiError("invalid_request", "discoId, meterType, meter, amount, phone and reference (a UUID) are required.", 400);
  }
  const { options, extra } = purchaseOptions(auth.ctx, body);
  try {
    const result = await runElectricityPurchase(
      { sub: auth.ctx.customerId, name: auth.ctx.customerName },
      { discoId, meterType, meter, amount, phone: normalizePhone(phone), reference, ...extra }, options,
    );
    return purchaseResponse(reference, result);
  } catch (error) {
    console.error("[api] electricity purchase", reference, error);
    return apiError("server_error", "Something went wrong. Check the order status before retrying.", 500);
  }
}
