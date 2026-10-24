import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { AdminQuickLinks } from "@/components/admin/admin-quick-links";
import { RecentActivity } from "@/components/admin/recent-activity";
import { RevenueByService } from "@/components/admin/revenue-by-service";
import { StatCards } from "@/components/admin/stat-cards";
import { getAdminOverview } from "@/lib/admin/overview-data";
import { formatLongDate } from "@/lib/format";

export const metadata: Metadata = { title: "Admin overview | Spur VTU" };

export default async function AdminOverviewPage() {
  const data = await getAdminOverview();
  const { pending, failed } = data.attention;
  const needsAttention = pending + failed > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">{formatLongDate()}</p>
      </header>

      {needsAttention && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-[#F2B632]/60 bg-[#FFF8E1] p-5 dark:border-[#F2B632]/30 dark:bg-[#F2B632]/10"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#7A5600] dark:text-[#F2B632]" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[#12343B] dark:text-[#EEF3F4]">Some transactions need a look</p>
            <p className="mt-1 text-sm text-[#5C4A12] dark:text-[#D9C48A]">
              {pending} pending and {failed} failed in the latest activity. Check them below and refund or retry where needed.
            </p>
          </div>
        </div>
      )}

      <StatCards data={data} />

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <RecentActivity transactions={data.recent} />
        </div>
        <div className="min-w-0">
          <RevenueByService total={data.monthRevenue} byService={data.revenueByService} />
        </div>
      </div>

      <AdminQuickLinks />
    </div>
  );
}