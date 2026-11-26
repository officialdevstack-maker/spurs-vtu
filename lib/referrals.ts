import "server-only";
import { insertNotification } from "@/lib/db/announcements";
import { awardReferralFor } from "@/lib/db/referrals";
import { formatNaira } from "@/lib/format";

export async function awardReferral(transactionId: string): Promise<void> {
  try {
    const payout = await awardReferralFor(transactionId);
    if (!payout) return;
    if (payout.refereeReward > 0) {
      await insertNotification({
        id: `ref-${payout.refereeId}-referee`,
        customerId: payout.refereeId,
        title: "Welcome bonus unlocked",
        body: `${formatNaira(payout.refereeReward)} cashback was added to your account. Use it on your next purchase.`,
      });
    }
    if (payout.referrerReward > 0) {
      await insertNotification({
        id: `ref-${payout.refereeId}-referrer`,
        customerId: payout.referrerId,
        title: "You earned a referral reward",
        body: `A friend you invited made their first purchase. ${formatNaira(payout.referrerReward)} cashback was added to your account.`,
      });
    }
  } catch (error) {
    console.error("[referrals] Could not award referral", transactionId, error);
  }
}
