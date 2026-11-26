import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { pinProblem } from "@/lib/pin";
import { changePin } from "@/lib/db/pin";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "purchase");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const problem = pinProblem(body?.nextPin);
  if (problem) return apiError("invalid_request", problem, 400);
  const result = await changePin(auth.ctx.customerId, body?.currentPin, body?.nextPin as string);
  return result.ok ? apiOk({ hasPin: true }) : apiError("pin_invalid", result.error, 403);
}
