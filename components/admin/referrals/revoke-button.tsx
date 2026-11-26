"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { revokeReferral } from "@/app/admin/products/referrals/activity/actions";

export function RevokeReferralButton({ refereeId }: { refereeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this pending referral? The friend can then be linked again.")) return;
        startTransition(async () => {
          const result = await revokeReferral(refereeId);
          if (!result.ok) return void toast.error(result.error ?? "Could not remove it.");
          router.refresh();
        });
      }}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
