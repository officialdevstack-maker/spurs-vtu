import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getDataCatalog } from "@/lib/db/data-purchase";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "catalog");
  if (!auth.ok) return auth.response;
  try {
    const networks = await getDataCatalog(auth.ctx.packageId);
    return apiOk({
      networks: networks.map((network) => ({
        id: network.id,
        name: network.name,
        types: network.types,
        plans: network.plans.map((plan) => ({
          id: plan.id,
          typeId: plan.typeId,
          size: plan.size,
          validity: plan.validity,
          price: plan.price,
        })),
      })),
    });
  } catch (error) {
    console.error("[api] data catalog", error);
    return apiError("server_error", "Something went wrong. Try again.", 500);
  }
}
