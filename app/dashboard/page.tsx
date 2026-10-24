import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { BalanceCards } from "@/components/dashboard/balance-card";
import { PackageCard } from "@/components/dashboard/package-card";
import { QuickServices } from "@/components/dashboard/quick-services";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SpendSummary } from "@/components/dashboard/spend-summary";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatLongDate, greetingFor } from "@/lib/format";
import { getSpursUser } from "@spurs-cloud/accounts/next";

export const metadata: Metadata = { title: "Dashboard | Spur VTU" };

// The greeting depends on the current time and the data is per user.
// export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const user = await getSpursUser();
  const username = user && "username" in user && typeof user.username === "string" ? user.username : undefined;
  const verified = user && "kyc_status" in user && user.kyc_status === "verified";
  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            {greetingFor(now)}, {user?.name}
          </h1>
          {username && <p className="mt-1 font-medium text-gray-600 dark:text-[#9FB3B7]">@{username}</p>}
          <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">{formatLongDate(now)}</p>
        </div>

        {verified ? (
          <p className="flex items-center gap-2 rounded-full bg-[#E6F4EC] px-3 py-1 text-sm font-medium text-[#14693A] dark:bg-[#4CC38A]/15 dark:text-[#4CC38A]">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Verified
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-full bg-[#FFF3D1] px-3 py-1 text-sm font-medium text-[#7A5600] dark:bg-[#F2B632]/15 dark:text-[#F2B632]">
            <ShieldAlert className="size-4" aria-hidden="true" />
            Not verified
          </p>
        )}
      </header>

      {!verified && (
        <div
          role="status"
          className="flex flex-col gap-4 rounded-2xl border border-[#F2B632]/60 bg-[#FFF8E1] p-5 dark:border-[#F2B632]/30 dark:bg-[#F2B632]/10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold text-[#12343B] dark:text-[#EEF3F4]">Verify your account to get your funding account number</p>
            <p className="mt-1 text-sm text-[#5C4A12] dark:text-[#D9C48A]">
              Once verified, you can fund your wallet by bank transfer at any time.
            </p>
          </div>
          <Link
            href="/verify"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#12343B] px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0C2429] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 dark:bg-[#F2B632] dark:text-[#12343B] dark:hover:bg-[#E5A720] dark:focus-visible:ring-[#F2B632] dark:focus-visible:ring-offset-[#0B1B1F]"
          >
            Verify now
          </Link>
        </div>
      )}

      <BalanceCards wallet={data.wallet.balance} bonus={data.bonus.balance} />

      <QuickServices />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <RecentTransactions transactions={data.transactions} />
        <div className="space-y-8">
          <PackageCard pkg={data.package} />
          <SpendSummary spend={data.spend} />
        </div>
      </div>
    </div>
  );
}