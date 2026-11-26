import type { Metadata } from "next";
import { connection } from "next/server";
import { RevokeReferralButton } from "@/components/admin/referrals/revoke-button";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { listReferrals } from "@/lib/db/referrals";
import { formatWhen } from "@/lib/format";

export const metadata: Metadata = { title: "Referral activity | Spur VTU" };

export default async function ReferralActivityPage() {
  await connection();
  await requirePermission("products.view");
  const { permissions } = await getAdminAccess();
  const referrals = await listReferrals();
  const canManage = permissions.has("products.manage");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Referral activity</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Who invited whom, and which referrals have been rewarded. Latest 50.</p>
      </header>
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {referrals.length === 0 ? (
          <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">No referrals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                <tr>
                  <th scope="col" className="px-5 py-3">Friend</th>
                  <th scope="col" className="px-5 py-3">Invited by</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">Joined</th>
                  <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {referrals.map((referral) => (
                  <tr key={referral.refereeId}>
                    <td className="px-5 py-3">{referral.referee}</td>
                    <td className="px-5 py-3">{referral.referrer}</td>
                    <td className="px-5 py-3">{referral.status === "rewarded" ? `Rewarded ${referral.rewardedAt ? formatWhen(referral.rewardedAt) : ""}` : "Waiting on first purchase"}</td>
                    <td className="whitespace-nowrap px-5 py-3">{formatWhen(referral.at)}</td>
                    <td className="px-5 py-3 text-right">
                      {canManage && referral.status === "pending" && <RevokeReferralButton refereeId={referral.refereeId} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
