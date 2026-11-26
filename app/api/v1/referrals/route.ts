import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { ensureReferralCode, getReferralOverview, recordReferral } from "@/lib/db/referrals";
import { REFERRAL_CODE } from "@/lib/admin/referrals";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  const [overview, code] = await Promise.all([
    getReferralOverview(auth.ctx.customerId),
    ensureReferralCode(auth.ctx.customerId),
  ]);
  return apiOk({ code, ...overview });
}

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!REFERRAL_CODE.test(code)) return apiError("invalid_request", "Referral code is invalid.", 400);
  return await recordReferral(auth.ctx.customerId, code)
    ? apiOk({ applied: true })
    : apiError("conflict", "That referral code cannot be used for this account.", 409);
}
