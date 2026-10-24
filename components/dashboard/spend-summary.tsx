import { formatNaira, monthName } from "@/lib/format";
import type { DashboardData } from "@/lib/dashboard-data";

export function SpendSummary({ spend }: { spend: DashboardData["spend"] }) {
  const max = Math.max(1, ...spend.byService.map((s) => s.amount));
  const sorted = [...spend.byService].sort((a, b) => b.amount - a.amount);

  return (
    <section aria-labelledby="spend-summary">
      <h2 id="spend-summary" className="font-[family-name:var(--font-display)] text-lg font-bold">
        Spent in {monthName()}
      </h2>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">
        {formatNaira(spend.total)}
      </p>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600 dark:text-[#9FB3B7]">Nothing spent yet this month.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sorted.map((item, i) => (
            <li key={item.label}>
              <div className="flex items-baseline justify-between text-sm">
                <span>{item.label}</span>
                <span className="font-medium tabular-nums">{formatNaira(item.amount)}</span>
              </div>
              {/* The amounts are the data; the bar is only a visual aid. */}
              <div aria-hidden="true" className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                <div
                  className={`h-full rounded-full ${i === 0 ? "bg-[#F2B632]" : "bg-[#12343B] dark:bg-[#9FB3B7]"}`}
                  style={{ width: `${(item.amount / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}