import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getCableCatalog } from "@/lib/db/cable";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "catalog");
  if (!auth.ok) return auth.response;
  try {
    const operators = await getCableCatalog(auth.ctx.packageId);
    return apiOk({ operators: operators.map((operator) => ({
      id: operator.id, name: operator.name,
      plans: operator.plans.map((plan) => ({ id: plan.id, name: plan.name, validity: plan.validity, price: plan.price })),
    })) });
  } catch (error) {
    console.error("[api] cable catalog", error);
    return apiError("server_error", "Something went wrong. Try again.", 500);
  }
}
