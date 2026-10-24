import Link from "next/link";
import { Check } from "lucide-react";
import { formatNaira } from "@/lib/format";
import type { DashboardData } from "@/lib/dashboard-data";

export function PackageCard({ pkg }: { pkg: DashboardData["package"] }) {
  const next = pkg.next;
  const percent = next ? Math.round(Math.min(1, Math.max(0, next.progress)) * 100) : 0;

  return (
    <section
      aria-labelledby="your-package"
      className="rounded-2xl border border-gray-200 bg-gray-100 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="your-package" className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            Your package
          </h2>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold">{pkg.name}</p>
        </div>
        <span aria-hidden="true" className="mt-1 h-6 w-1.5 rounded-full bg-[#F2B632]" />
      </div>

      <ul className="mt-4 space-y-2">
        {pkg.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-[#1E8E4F] dark:text-[#4CC38A]" aria-hidden="true" />
            {perk}
          </li>
        ))}
      </ul>

      {next && (
        <div className="mt-5 border-t border-gray-200 pt-4 dark:border-white/10">
          <p className="text-sm">
            Spend <span className="font-semibold tabular-nums">{formatNaira(next.remaining)}</span> more to reach{" "}
            <span className="font-semibold">{next.name}</span>.
          </p>
          <div
            role="progressbar"
            aria-label={`Progress to ${next.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
          >
            <div className="h-full rounded-full bg-[#1E8E4F] dark:bg-[#4CC38A]" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      <Link
        href="/packages"
        className="mt-5 inline-block rounded text-sm font-semibold underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
      >
        See all packages
      </Link>
    </section>
  );
}