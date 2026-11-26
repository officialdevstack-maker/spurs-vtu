import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { isPromoService } from "@/lib/admin/promotions";
import { quotePromo } from "@/lib/promotions";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "purchase");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const code = body?.code;
  const service = body?.service;
  const price = body?.price;
  if (typeof code !== "string" || typeof code !== "string" || !isPromoService(service) ||
      typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return apiError("invalid_request", "Code, service and price are required.", 400);
  }
  const quote = await quotePromo({ code, customerId: auth.ctx.customerId, service, price, cost: null });
  return quote.ok
    ? apiOk({ code: quote.code, discount: quote.discount, finalPrice: quote.finalPrice })
    : apiError("promo_invalid", quote.error, 422);
}
