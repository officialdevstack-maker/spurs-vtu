import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getElectricityCatalog } from "@/lib/db/electricity";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "catalog");
  if (!auth.ok) return auth.response;
  try {
    const discos = await getElectricityCatalog(auth.ctx.packageId);
    return apiOk({ discos: discos.map((disco) => ({
      id: disco.id, name: disco.name, min: disco.min, max: disco.max, discount: disco.discount,
    })) });
  } catch (error) {
    console.error("[api] electricity catalog", error);
    return apiError("server_error", "Something went wrong. Try again.", 500);
  }
}
