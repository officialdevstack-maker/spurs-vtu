import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getNairaBalance } from "@/lib/wallet";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  const balance = await getNairaBalance(auth.ctx.customerId);
  if (balance === null) return apiError("unavailable", "Your balance can't be read right now.", 503);
  return apiOk({ balance, currency: "NGN" });
}
