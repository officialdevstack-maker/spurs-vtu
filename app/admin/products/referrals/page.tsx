import type { Metadata } from "next";
import { connection } from "next/server";
import { ReferralsManager } from "@/components/admin/referrals/manager";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { getReferralSettings } from "@/lib/db/referrals";

export const metadata: Metadata = { title: "Referrals | Spur VTU" };

export default async function ReferralsAdminPage() {
  await connection();
  await requirePermission("products.view");
  const { permissions } = await getAdminAccess();
  const settings = await getReferralSettings();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Referrals</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Rewards are paid as cashback after a referred customer&apos;s first qualifying purchase.
        </p>
      </header>
      <ReferralsManager settings={settings} canManage={permissions.has("products.manage")} />
    </div>
  );
}
