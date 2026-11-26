"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { claimReferral } from "@/app/dashboard/referrals/actions";

export function ReferralClaim() {
  const router = useRouter();
  useEffect(() => {
    void claimReferral().then(() => router.refresh());
  }, [router]);
  return null;
}
