import "server-only";
import { awardCashback } from "@/lib/cashback";
import { awardReferral } from "@/lib/referrals";

export async function onPurchaseSuccess(transactionId: string): Promise<void> {
  await awardCashback(transactionId);
  await awardReferral(transactionId);
}
