import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { removePin } from "@/lib/db/pin";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "purchase");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const result = await removePin(auth.ctx.customerId, body?.pin);
  return result.ok ? apiOk({ hasPin: false }) : apiError("pin_invalid", result.error, 403);
}
