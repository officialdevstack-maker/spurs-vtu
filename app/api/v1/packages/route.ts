import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { listPackages } from "@/lib/db/packages";
import { getCustomerPackage } from "@/lib/db/packages";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "catalog");
  if (!auth.ok) return auth.response;
  try {
    const [packages, current] = await Promise.all([
      listPackages(),
      getCustomerPackage(auth.ctx.customerId),
    ]);
    return apiOk({ current: current?.id ?? null, items: packages });
  } catch (error) {
    console.error("[api] packages", error);
    return apiError("server_error", "Something went wrong.", 500);
  }
}
