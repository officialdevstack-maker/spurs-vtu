import Link from "next/link";
import { Receipt, Smartphone, Tv, Wallet, Wifi, Zap, type LucideIcon } from "lucide-react";
import { formatNaira, formatWhen } from "@/lib/format";
import type { Transaction, TxService, TxStatus } from "@/lib/dashboard-data";

const ICONS: Record<TxService, LucideIcon> = {
  airtime: Smartphone,
  data: Wifi,
  cable: Tv,
  electricity: Zap,
  wallet: Wallet,
};

// Status is always written out, never colour alone.
const STATUS: Record<TxStatus, { label: string; dot: string }> = {
  success: { label: "Successful", dot: "bg-[#1E8E4F] dark:bg-[#4CC38A]" },
  pending: { label: "Pending", dot: "bg-[#F2B632]" },
  failed: { label: "Failed", dot: "bg-[#C8432B]" },
};

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  const now = new Date();

  return (
    <section aria-labelledby="recent-transactions">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="recent-transactions" className="font-[family-name:var(--font-display)] text-lg font-bold">
          Recent transactions
        </h2>
        <Link
          href="/transactions"
          className="rounded text-sm font-semibold underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
        >
          View all
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <Receipt className="mx-auto size-8 text-gray-400" aria-hidden="true" />
          <p className="mt-3 font-medium">No transactions yet</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Your purchases and wallet top-ups will show up here.</p>
          <Link
            href="/airtime"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#F2B632] px-4 text-sm font-semibold text-[#12343B] outline-none hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B]"
          >
            Buy airtime
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
          {transactions.map((tx) => {
            const Icon = ICONS[tx.service];
            const status = STATUS[tx.status];
            const credit = tx.direction === "credit";
            return (
              <li key={tx.id} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gray-100 text-[#12343B] dark:bg-white/10 dark:text-[#EEF3F4]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tx.title}</p>
                  <p className="truncate text-sm text-gray-600 dark:text-[#9FB3B7]">
                    {tx.detail} · {formatWhen(tx.at, now)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`font-semibold tabular-nums ${credit ? "text-[#1E8E4F] dark:text-[#4CC38A]" : ""}`}
                  >
                    {credit ? "+" : ""}
                    {formatNaira(tx.amount)}
                  </p>
                  <p className="mt-0.5 flex items-center justify-end gap-1.5 text-sm text-gray-600 dark:text-[#9FB3B7]">
                    <span aria-hidden="true" className={`size-2 rounded-full ${status.dot}`} />
                    {status.label}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}