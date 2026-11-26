export type ReferralSettings = {
  enabled: boolean;
  referrerReward: number;
  refereeReward: number;
  minPurchase: number;
  monthlyLimit: number;
};

export type ReferralOverview = {
  invited: number;
  rewarded: number;
  earned: number;
  waitingOnFirstPurchase: boolean;
  hasReferrer: boolean;
};

export type AdminReferral = {
  refereeId: string;
  referee: string;
  referrer: string;
  status: "pending" | "rewarded";
  at: string;
  rewardedAt: string | null;
};

export const REFERRALS_PATH = "/admin/products/referrals";
export const CUSTOMER_REFERRALS_PATH = "/dashboard/referrals";
export const REFERRAL_CODE = /^[A-Z2-9]{8}$/;
export const REFERRAL_ACTIVITY_PATH = "/admin/products/referrals/activity";
