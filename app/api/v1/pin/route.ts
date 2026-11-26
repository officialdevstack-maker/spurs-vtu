import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { pinProblem } from "@/lib/pin";
import { setInitialPin } from "@/lib/db/pin";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "purchase");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const pin = body?.pin;
  const problem = pinProblem(pin);
  if (problem) return apiError("invalid_request", problem, 400);
  const set = await setInitialPin(auth.ctx.customerId, pin as string);
  return set
    ? apiOk({ hasPin: true })
    : apiError("conflict", "A PIN is already set.", 409);
}
