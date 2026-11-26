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
};

export const REFERRALS_PATH = "/admin/products/referrals";
export const CUSTOMER_REFERRALS_PATH = "/dashboard/referrals";
export const REFERRAL_CODE = /^[A-Z2-9]{8}$/;
