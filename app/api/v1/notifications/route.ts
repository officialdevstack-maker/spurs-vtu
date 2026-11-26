import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { listNotifications } from "@/lib/db/announcements";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  try {
    const limit = Math.max(1, Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 50), 100));
    return apiOk({ items: await listNotifications(auth.ctx.customerId, limit) });
  } catch (error) {
    console.error("[api] notifications", error);
    return apiError("server_error", "Something went wrong.", 500);
  }
}
