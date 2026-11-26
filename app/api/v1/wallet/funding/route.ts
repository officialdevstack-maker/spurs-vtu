import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getFlutterwaveAccount, getRecentFundingIntents } from "@/lib/db/wallet";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  try {
    const [permanent, pending] = await Promise.all([
      getFlutterwaveAccount(auth.ctx.customerId),
      getRecentFundingIntents(auth.ctx.customerId, 10),
    ]);
    return apiOk({
      permanent: permanent?.status === "active"
        ? { accountNumber: permanent.accountNumber, bankName: permanent.bankName, accountName: permanent.accountName }
        : null,
      pending,
    });
  } catch (error) {
    console.error("[api] wallet funding", error);
    return apiError("server_error", "Something went wrong.", 500);
  }
}
