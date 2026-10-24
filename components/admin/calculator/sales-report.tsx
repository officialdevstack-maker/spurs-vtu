import Link from "next/link";
import { Banknote, Receipt, ShoppingBag, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatNaira, formatNumber } from "@/lib/format";
import type { SalesReport } from "@/lib/db/transactions";
import { SERVICE_OPTIONS } from "@/lib/transactions-history";
import { formatDay, presetRanges, reportHref, type ReportRange } from "@/lib/sales-report";

const th = "px-3 py-3 text-left text-sm font-medium text-gray-600 dark:text-[#9FB3B7] sm:px-5";
const td = "px-3 py-4 sm:px-5";
const muted = "text-gray-600 dark:text-[#9FB3B7]";
const tableWrap = "overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10";
const fieldClass =
  "h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]";

const serviceLabel = (id: string) => SERVICE_OPTIONS.find((option) => option.id === id)?.label ?? id;

/** Written out so it never relies on colour alone. */
const profitText = (value: number) =>
  value < 0 ? `Loss of ${formatNaira(Math.abs(value))}` : formatNaira(value);

function Heading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-3 font-[family-name:var(--font-display)] text-lg font-bold">
      {children}
    </h2>
  );
}

export function SalesFilters({ basePath, range }: { basePath: string; range: ReportRange }) {
  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-100 p-4 dark:border-white/10 dark:bg-white/5">
      <form method="get" action={basePath} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="sales-from" className="mb-2 block text-sm font-medium">
            From
          </label>
          <input id="sales-from" name="from" type="date" defaultValue={range.from} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label htmlFor="sales-to" className="mb-2 block text-sm font-medium">
            To
          </label>
          <input id="sales-to" name="to" type="date" defaultValue={range.to} className={`${fieldClass} w-full`} />
        </div>
        <button
          type="submit"
          className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] outline-none hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B]"
        >
          Show sales
        </button>
      </form>

      <ul className="flex flex-wrap gap-2">
        {presetRanges().map((preset) => {
          const current = preset.from === range.from && preset.to === range.to;
          return (
            <li key={preset.label}>
              <Link
                href={reportHref(basePath, preset)}
                aria-current={current ? "true" : undefined}
                className={`inline-flex rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632] ${
                  current
                    ? "bg-white shadow-sm ring-1 ring-gray-200 dark:bg-white/10 dark:ring-white/10"
                    : `${muted} hover:bg-gray-200/70 dark:hover:bg-white/5`
                }`}
              >
                {preset.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Stat = { label: string; value: string; note: string; icon: LucideIcon };

export function SalesReportView({ report }: { report: SalesReport }) {
  const totals = report.services.reduce(
    (sum, row) => ({
      sold: sum.sold + row.sold,
      revenue: sum.revenue + row.revenue,
      cost: sum.cost + row.cost,
      profit: sum.profit + row.profit,
      unknownCost: sum.unknownCost + row.unknownCost,
    }),
    { sold: 0, revenue: 0, cost: 0, profit: 0, unknownCost: 0 },
  );

  const stats: Stat[] = [
    { label: "Orders sold", value: formatNumber(totals.sold), note: "Successful only", icon: ShoppingBag },
    { label: "Revenue", value: formatNaira(totals.revenue), note: "Paid by customers", icon: Banknote },
    { label: "Provider cost", value: formatNaira(totals.cost), note: "Paid to providers", icon: Receipt },
    {
      label: "Profit",
      value: profitText(totals.profit),
      note: totals.unknownCost > 0 ? `${formatNumber(totals.unknownCost)} sales have no cost recorded` : "Revenue minus cost",
      icon: TrendingUp,
    },
  ];

  if (report.services.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
        <Receipt className="mx-auto size-8 text-gray-400" aria-hidden="true" />
        <p className="mt-3 font-medium">No sales in this range</p>
        <p className={`mt-1 text-sm ${muted}`}>Try a wider range of dates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <div
            key={label}
            className="min-w-0 rounded-2xl border border-gray-200 bg-gray-100 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`text-sm ${muted}`}>{label}</p>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#12343B] ring-1 ring-gray-200 dark:bg-white/10 dark:text-[#EEF3F4] dark:ring-white/10">
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p
              className={`mt-3 truncate font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums sm:text-3xl ${
                label === "Profit" && totals.profit < 0 ? "text-[#C8432B]" : ""
              }`}
            >
              {value}
            </p>
            <p className={`mt-1 text-sm ${muted}`}>{note}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="sales-by-service">
        <Heading id="sales-by-service">By service</Heading>
        <div className={tableWrap}>
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-gray-200 dark:border-white/10">
              <tr>
                <th scope="col" className={th}>Service</th>
                <th scope="col" className={`${th} text-right`}>Sold</th>
                <th scope="col" className={`${th} text-right`}>Pending</th>
                <th scope="col" className={`${th} text-right`}>Failed</th>
                <th scope="col" className={`${th} text-right`}>Revenue</th>
                <th scope="col" className={`${th} text-right`}>Cost</th>
                <th scope="col" className={`${th} text-right`}>Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {report.services.map((row) => (
                <tr key={row.service}>
                  <td className={`${td} font-medium`}>{serviceLabel(row.service)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatNumber(row.sold)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatNumber(row.pending)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatNumber(row.failed)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatNaira(row.revenue)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatNaira(row.cost)}</td>
                  <td className={`${td} text-right font-medium tabular-nums ${row.profit < 0 ? "text-[#C8432B]" : ""}`}>
                    {profitText(row.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="sales-by-day" className="min-w-0">
          <Heading id="sales-by-day">By day</Heading>
          <div className={tableWrap}>
            <table className="w-full min-w-[26rem] text-sm">
              <thead className="border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th scope="col" className={th}>Day</th>
                  <th scope="col" className={`${th} text-right`}>Orders</th>
                  <th scope="col" className={`${th} text-right`}>Revenue</th>
                  <th scope="col" className={`${th} text-right`}>Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {report.days.map((row) => (
                  <tr key={row.day}>
                    <td className={`${td} font-medium`}>{formatDay(row.day)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatNumber(row.sold)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatNaira(row.revenue)}</td>
                    <td className={`${td} text-right tabular-nums ${row.profit < 0 ? "text-[#C8432B]" : ""}`}>
                      {profitText(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="sales-top" className="min-w-0">
          <Heading id="sales-top">Top items</Heading>
          <ol className="divide-y divide-gray-200 rounded-2xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
            {report.top.map((item, index) => (
              <li key={item.title} className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold dark:bg-white/10"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className={`text-sm ${muted}`}>{formatNumber(item.sold)} sold</p>
                </div>
                <p className="shrink-0 text-right font-medium tabular-nums">{formatNaira(item.revenue)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
