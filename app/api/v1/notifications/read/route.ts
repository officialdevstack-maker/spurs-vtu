import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { markAllNotificationsRead } from "@/lib/db/announcements";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  await markAllNotificationsRead(auth.ctx.customerId);
  return apiOk({ read: true });
}
