import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { upgradePackage } from "@/lib/purchase/package";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "purchase");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  if (typeof body?.packageId !== "string") return apiError("invalid_request", "packageId is required.", 400);
  const result = await upgradePackage(auth.ctx.customerId, body.packageId, body.pin);
  return result.ok ? apiOk({ upgraded: true }) : apiError("upgrade_failed", result.error, 422);
}
