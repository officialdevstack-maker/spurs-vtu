import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getPaymentPointProviderSettings } from "@/lib/db/payment-providers";
import {
  getFlutterwaveAccount,
  getRecentFundingIntents,
  getRecentPaymentPointFundingIntents,
} from "@/lib/db/wallet";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  try {
    const [permanent, flutterwavePending, paymentPointPending, paymentPointSettings] = await Promise.all([
      getFlutterwaveAccount(auth.ctx.customerId),
      getRecentFundingIntents(auth.ctx.customerId, 10),
      getRecentPaymentPointFundingIntents(auth.ctx.customerId, 10),
      getPaymentPointProviderSettings(),
    ]);
    return apiOk({
      permanent: permanent?.status === "active"
        ? { accountNumber: permanent.accountNumber, bankName: permanent.bankName, accountName: permanent.accountName }
        : null,
      pending: [...paymentPointPending, ...flutterwavePending],
      minimumDepositKobo: paymentPointSettings?.minimumDepositKobo ?? 10_000,
    });
  } catch (error) {
    console.error("[api] wallet funding", error);
    return apiError("server_error", "Something went wrong.", 500);
  }
}
