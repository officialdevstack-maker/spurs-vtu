import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getAirtimeCatalog } from "@/lib/db/airtime-purchase";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "catalog");
  if (!auth.ok) return auth.response;
  try {
    return apiOk({ networks: await getAirtimeCatalog() });
  } catch (error) {
    console.error("[api] airtime catalog", error);
    return apiError("server_error", "Something went wrong. Try again.", 500);
  }
}
