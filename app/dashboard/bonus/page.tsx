import type { Metadata } from "next";
import { connection } from "next/server";
import { Gift } from "lucide-react";
import { getCashbackBalance } from "@/lib/cashback";
import { getPublicCashbackRules, listCashbackHistory } from "@/lib/db/cashback";
import { formatNaira, formatWhen } from "@/lib/format";
import { requireSpursUser } from "@/lib/spurs";
import { CASHBACK_SERVICES } from "@/lib/admin/cashback";

export const metadata: Metadata = { title: "Cashback | Spur VTU" };
export const instant = false;

const SOURCE_LABEL = { earn: "Earned", spend: "Spent on a purchase", restore: "Returned after a refund", referral: "Referral reward" } as const;

export default async function CashbackPage() {
  await connection();
  const user = await requireSpursUser();
  const [balance, rules, history] = await Promise.all([
    getCashbackBalance(user.sub),
    getPublicCashbackRules(),
    listCashbackHistory(user.sub),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header><h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Cashback</h1><p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Earn cashback on purchases and spend it at checkout.</p></header>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#9FB3B7]"><Gift className="size-4" aria-hidden="true" /> Available cashback</p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tabular-nums">{formatNaira(balance)}</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-[#9FB3B7]">Tick “Use cashback” when you buy. It is spent first, and your wallet covers the rest. Cashback can’t be withdrawn.</p>
      </section>
      {rules.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
          <h2 className="font-semibold">Where you earn</h2>
          <ul className="mt-3 space-y-2 text-sm">{rules.map((rule) => (
            <li key={rule.service} className="flex justify-between gap-4"><span>{CASHBACK_SERVICES.find((s) => s.id === rule.service)?.label}</span><span className="text-gray-600 dark:text-[#9FB3B7]">{rule.percent}%{rule.minSpend > 0 && ` on ${formatNaira(rule.minSpend)}+`}{rule.monthlyCap !== null && `, up to ${formatNaira(rule.monthlyCap)} a month`}</span></li>
          ))}</ul>
        </section>
      )}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {history.length === 0 ? <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">No cashback activity yet.</p> : (
          <ul className="divide-y divide-gray-200 dark:divide-white/10">{history.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
              <div><p className="font-medium">{SOURCE_LABEL[entry.source]}</p><p className="text-xs text-gray-600 dark:text-[#9FB3B7]">{formatWhen(entry.at)}</p></div>
              <p className={`font-semibold tabular-nums ${entry.direction === "credit" ? "text-[#1E8E4F] dark:text-[#4CC38A]" : ""}`}>{entry.direction === "credit" ? "+" : "−"}{formatNaira(entry.amount)}</p>
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}