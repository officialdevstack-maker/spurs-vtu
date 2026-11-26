import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { lookupSmartcard } from "@/lib/cable-lookup";
import { SMARTCARD_PATTERN } from "@/lib/cable-purchase";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "catalog");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const { operatorId, smartcard } = body ?? {};
  if (typeof operatorId !== "string" || !/^[a-z0-9-]{1,40}$/.test(operatorId) ||
    typeof smartcard !== "string" || !SMARTCARD_PATTERN.test(smartcard)) {
    return apiError("invalid_request", "operatorId and a 10 or 11 digit smartcard are required.", 400);
  }
  const result = await lookupSmartcard(operatorId, smartcard);
  if (result.status === "found") return apiOk({ valid: true, name: result.name });
  if (result.status === "invalid") return apiOk({ valid: false });
  return apiError("unavailable", "Smartcard checks aren't available right now.", 503);
}
