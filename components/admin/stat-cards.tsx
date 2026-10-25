import { Banknote, Landmark, Receipt, Users, type LucideIcon } from "lucide-react";
import { formatNaira, formatNumber } from "@/lib/format";
import type { AdminOverview } from "@/lib/admin/overview-data";

type Stat = { label: string; value: string; note: string; icon: LucideIcon };

export function StatCards({ data }: { data: AdminOverview }) {
  const stats: Stat[] = [
    {
      label: "Total users",
      value: formatNumber(data.users.total),
      note: `+${formatNumber(data.users.newThisWeek)} this week`,
      icon: Users,
    },
    {
      label: "Wallet float",
      value: data.walletFloat === null ? "Unavailable" : formatNaira(data.walletFloat),
      note: data.walletFloat === null ? "Total across wallets isn't connected" : "Held across all wallets",
      icon: Landmark,
    },
    {
      label: "Sales today",
      value: formatNaira(data.today.revenue),
      note: "Successful purchases only",
      icon: Banknote,
    },
    {
      label: "Transactions today",
      value: formatNumber(data.today.transactions),
      note:
        data.today.transactions === 0
          ? "No purchases yet today"
          : `${(data.today.successRate * 100).toFixed(1)}% of settled orders successful`,
      icon: Receipt,
    },
  ];

  return (
    <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, note, icon: Icon }) => (
        <div
          key={label}
          className="min-w-0 rounded-2xl border border-gray-200 bg-gray-100 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">{label}</p>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#12343B] ring-1 ring-gray-200 dark:bg-white/10 dark:text-[#EEF3F4] dark:ring-white/10">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 truncate font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums sm:text-3xl">
            {value}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">{note}</p>
        </div>
      ))}
    </section>
  );
}
