import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Smartphone, Tv, Wifi, Zap, type LucideIcon } from "lucide-react";

export const metadata: Metadata = { title: "Services | Spur VTU" };

type Service = {
  name: string;
  text: string;
  icon: LucideIcon;
  href?: string;
};

const SERVICES: Service[] = [
  { name: "Airtime", text: "Top up any line on any network.", icon: Smartphone, href: "/dashboard/airtime" },
  { name: "Data", text: "Data plans for every network and budget.", icon: Wifi, href: "/dashboard/data" },
  { name: "Electricity", text: "Prepaid and postpaid meter tokens.", icon: Zap, href: "/dashboard/electricity" },
  { name: "Cable TV", text: "Renew your DStv, GOtv or StarTimes subscription.", icon: Tv, href: "/dashboard/cable" },
  { name: "Exam pins", text: "WAEC, NECO and NABTEB result checker pins.", icon: GraduationCap },
];

const card =
  "flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5";
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]";

function Body({ service }: { service: Service }) {
  const { name, text, icon: Icon, href } = service;
  return (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gray-100 text-[#12343B] dark:bg-white/10 dark:text-[#EEF3F4]">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold">
          {name}
          {!href && (
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-[#9FB3B7]">
              Coming soon
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">{text}</p>
      </div>
    </>
  );
}

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Services</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Everything you can buy from your wallet.</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => (
          <li key={service.name}>
            {service.href ? (
              <Link
                href={service.href}
                className={`${card} ${focusRing} transition-colors hover:bg-gray-100 dark:hover:bg-white/10`}
              >
                <Body service={service} />
              </Link>
            ) : (
              <div aria-disabled="true" className={`${card} opacity-70`}>
                <Body service={service} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
