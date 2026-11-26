import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { BalanceCards } from "@/components/dashboard/balance-card";
import { PackageCard } from "@/components/dashboard/package-card";
import { QuickServices } from "@/components/dashboard/quick-services";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SpendSummary } from "@/components/dashboard/spend-summary";
import { getPackageCard } from "@/lib/dashboard-package";
import { getMonthlySpend, getRecentTransactions } from "@/lib/db/transactions";
import { formatLongDate, greetingFor } from "@/lib/format";
import { getNairaBalance } from "@/lib/wallet";
import { getSpursUser } from "@/lib/spurs";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { WelcomeModal } from "@/components/dashboard/welcome-modal";
import { renderTemplate } from "@/lib/admin/announcements";
import { getUnseenWelcome } from "@/lib/db/announcements";
import { getCashbackBalance } from "@/lib/cashback";
import { cookies } from "next/headers";
import { ReferralClaim } from "@/components/dashboard/referral-claim";

export const metadata: Metadata = { title: "Dashboard | Spur VTU" };
export const instant = false;

async function DashboardContent() {
  await connection();
  const user = await getSpursUser();
  const hasReferralCookie = (await cookies()).has("ref");
  const username = user && "username" in user && typeof user.username === "string" ? user.username : undefined;
  const hasKycStatus = !!user && "kyc_status" in user;
  const verified = user && "kyc_status" in user && user.kyc_status === "verified";
  const now = new Date();

  const [balance, transactions, spend, welcome, cashback] = user
    ? await Promise.all([
        getNairaBalance(user.sub),
        getRecentTransactions(user.sub),
        getMonthlySpend(user.sub),
        getUnseenWelcome(user.sub).catch((error) => {
          console.error("[welcome] Could not load popup", error);
          return null;
        }),
        getCashbackBalance(user.sub),
      ])
    : [null, [], { total: 0, byService: [] }, null, 0];
  const pkg = user ? await getPackageCard(user.sub, balance) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {hasReferralCookie && <ReferralClaim />}
      {welcome && (
        <WelcomeModal
          key={welcome.version}
          version={welcome.version}
          title={renderTemplate(welcome.title, { name: user?.name ?? null, username: username ?? null })}
          body={renderTemplate(welcome.body, { name: user?.name ?? null, username: username ?? null })}
          ctaLabel={welcome.ctaLabel}
          ctaHref={welcome.ctaHref}
        />
      )}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            {greetingFor(now)}, {user?.name}
          </h1>
          {username && <p className="mt-1 font-medium text-gray-600 dark:text-[#9FB3B7]">@{username}</p>}
          <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">{formatLongDate(now)}</p>
        </div>

        {hasKycStatus && (
          verified ? (
            <p className="flex items-center gap-2 rounded-full bg-[#E6F4EC] px-3 py-1 text-sm font-medium text-[#14693A] dark:bg-[#4CC38A]/15 dark:text-[#4CC38A]">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Verified
            </p>
          ) : (
            <p className="flex items-center gap-2 rounded-full bg-[#FFF3D1] px-3 py-1 text-sm font-medium text-[#7A5600] dark:bg-[#F2B632]/15 dark:text-[#F2B632]">
              <ShieldAlert className="size-4" aria-hidden="true" />
              Not verified
            </p>
          )
        )}
      </header>

      {hasKycStatus && !verified && (
        <div
          role="status"
          className="flex flex-col gap-4 rounded-2xl border border-[#F2B632]/60 bg-[#FFF8E1] p-5 dark:border-[#F2B632]/30 dark:bg-[#F2B632]/10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold text-[#12343B] dark:text-[#EEF3F4]">Choose how you want to fund your wallet</p>
            <p className="mt-1 text-sm text-[#5C4A12] dark:text-[#D9C48A]">
              You can create a temporary account for one transfer or a permanent account using your own BVN.
            </p>
          </div>
          <Link
            href="/fund-wallet"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#12343B] px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0C2429] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 dark:bg-[#F2B632] dark:text-[#12343B] dark:hover:bg-[#E5A720] dark:focus-visible:ring-[#F2B632] dark:focus-visible:ring-offset-[#0B1B1F]"
          >
            Fund wallet
          </Link>
        </div>
      )}

      <BalanceCards wallet={balance} bonus={cashback} />

      <QuickServices />

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <RecentTransactions transactions={transactions} />
        </div>
        <div className="min-w-0 space-y-8">
          {pkg && <PackageCard pkg={pkg} />}
          <SpendSummary spend={spend} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
