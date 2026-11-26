import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { createResetToken } from "@/lib/db/pin";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "purchase");
  if (!auth.ok) return auth.response;
  const token = await createResetToken(auth.ctx.customerId);
  if (!token) return apiError("rate_limited", "A reset was requested recently.", 429);
  return apiOk({ resetUrl: `${process.env.APP_URL}/pin/reset?token=${encodeURIComponent(token)}` });
}
