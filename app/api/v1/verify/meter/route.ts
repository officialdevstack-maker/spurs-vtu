import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { METER_PATTERN, METER_TYPES } from "@/lib/electricity-purchase";
import { lookupMeter } from "@/lib/meter-lookup";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "catalog");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const type = METER_TYPES.find((item) => item.id === body?.meterType);
  const { discoId, meter } = body ?? {};
  if (typeof discoId !== "string" || !/^[a-z0-9-]{1,60}$/.test(discoId) || !type ||
    typeof meter !== "string" || !METER_PATTERN.test(meter)) {
    return apiError("invalid_request", "discoId, meterType (prepaid or postpaid) and a 10 to 13 digit meter are required.", 400);
  }
  const result = await lookupMeter(discoId, type.id, meter);
  if (result.status === "found") return apiOk({ valid: true, name: result.name, address: result.address });
  if (result.status === "invalid") return apiOk({ valid: false });
  return apiError("unavailable", "Meter checks aren't available right now.", 503);
}
