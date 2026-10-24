import { formatNaira, monthName } from "@/lib/format";
import type { AdminOverview } from "@/lib/admin/overview-data";

export function RevenueByService({ total, byService }: { total: number; byService: AdminOverview["revenueByService"] }) {
  const max = Math.max(1, ...byService.map((s) => s.amount));
  const sorted = [...byService].sort((a, b) => b.amount - a.amount);

  return (
    <section aria-labelledby="revenue-by-service" className="min-w-0">
      <h2 id="revenue-by-service" className="font-[family-name:var(--font-display)] text-lg font-bold">
        Revenue in {monthName()}
      </h2>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">{formatNaira(total)}</p>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600 dark:text-[#9FB3B7]">No sales yet this month.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sorted.map((item, i) => (
            <li key={item.label}>
              <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{item.label}</span>
                <span className="shrink-0 text-right font-medium tabular-nums">{formatNaira(item.amount)}</span>
              </div>
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
