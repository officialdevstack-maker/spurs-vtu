import type { Metadata } from "next";
import { connection } from "next/server";
import { CopyButton } from "@/components/dashboard/copy-button";
import { ensureReferralCode, getReferralOverview, getReferralSettings } from "@/lib/db/referrals";
import { formatNaira } from "@/lib/format";
import { requireSpursUser } from "@/lib/spurs";
import { ReferralCodeForm } from "@/components/dashboard/referral-code-form";

export const metadata: Metadata = { title: "Refer & earn | Spur VTU" };
export const instant = false;

export default async function ReferralsPage() {
  await connection();
  const user = await requireSpursUser();
  const [code, settings, overview] = await Promise.all([
    ensureReferralCode(user.sub),
    getReferralSettings(),
    getReferralOverview(user.sub),
  ]);
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const link = `${base}/r/${code}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Refer &amp; earn</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          {settings.enabled
            ? `Invite a friend. When they make a first purchase of ${formatNaira(settings.minPurchase)} or more, you get ${formatNaira(settings.referrerReward)} cashback and they get ${formatNaira(settings.refereeReward)}.`
            : "Referral rewards are not running right now. Your link will still work when they come back."}
        </p>
      </header>

      {overview.waitingOnFirstPurchase && settings.enabled && (
        <div role="status" className="rounded-2xl border border-[#F2B632]/60 bg-[#FFF8E1] p-5 text-sm text-[#5C4A12] dark:border-[#F2B632]/30 dark:bg-[#F2B632]/10 dark:text-[#D9C48A]">
          You joined through a friend&apos;s link. Fund your wallet and make a purchase of {formatNaira(settings.minPurchase)} or more to unlock {formatNaira(settings.refereeReward)} cashback.
        </div>
      )}

      {settings.enabled && !overview.hasReferrer && <ReferralCodeForm />}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">Your link</p>
        <p className="mt-2 break-all font-medium">{link}</p>
        <div className="mt-4"><CopyButton value={link} label="Copy link" /></div>
        <p className="mt-4 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Your code: <span className="font-mono font-semibold">{code}</span>
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Friends joined", String(overview.invited)],
          ["Rewarded", String(overview.rewarded)],
          ["Earned", formatNaira(overview.earned)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">{label}</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
