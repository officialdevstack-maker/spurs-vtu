import Link from "next/link";
import { History, LayoutGrid, Smartphone, Tv, Wifi, Zap, type LucideIcon } from "lucide-react";

const SERVICES: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Data", href: "/data", icon: Wifi },
  { label: "Airtime", href: "/airtime", icon: Smartphone },
  { label: "Cable TV", href: "/cable-tv", icon: Tv },
  { label: "Electricity", href: "/electricity", icon: Zap },
  { label: "History", href: "/transactions", icon: History },
  { label: "More", href: "/services", icon: LayoutGrid },
];

export function QuickServices() {
  return (
    <section aria-labelledby="quick-services">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="quick-services" className="font-[family-name:var(--font-display)] text-lg font-bold">
          Quick services
        </h2>
        <Link
          href="/services"
          className="rounded text-sm font-semibold underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
        >
          View all
        </Link>
      </div>

      {/* One bordered strip with hairline dividers, not six separate cards. */}
      <ul className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10 sm:grid-cols-6">
        {SERVICES.map(({ label, href, icon: Icon }) => (
          <li key={label} className="bg-white dark:bg-[#0B1B1F]">
            <Link
              href={href}
              className="group flex flex-col items-center gap-3 px-2 py-5 text-sm font-medium outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#12343B] dark:hover:bg-white/5 dark:focus-visible:ring-[#F2B632]"
            >
              <span className="grid size-11 place-items-center rounded-full bg-gray-100 text-[#12343B] transition-colors group-hover:bg-[#F2B632] dark:bg-white/10 dark:text-[#EEF3F4] dark:group-hover:text-[#12343B]">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}