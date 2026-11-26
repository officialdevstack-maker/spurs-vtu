import "server-only";
import type { ApiContext } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import type { PurchaseResult } from "@/lib/data-purchase";

export function purchaseResponse(reference: string, result: PurchaseResult): Response {
  if (result.ok) return apiOk({ reference, status: result.status, message: result.message });
  if (result.pin) return apiError("pin_required", result.error, 403);
  return apiError("purchase_failed", result.error, 422);
}

export function purchaseOptions(ctx: ApiContext, body: Record<string, unknown>) {
  if (ctx.kind === "key") return { options: { skipPin: true }, extra: {} };
  return {
    options: {},
    extra: {
      pin: body.pin,
      useCashback: body.useCashback === true,
      promoCode: typeof body.promoCode === "string" ? body.promoCode : undefined,
      skipNetworkCheck: body.skipNetworkCheck === true,
    },
  };
}
