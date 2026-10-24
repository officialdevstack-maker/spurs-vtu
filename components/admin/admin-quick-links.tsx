import Link from "next/link";
import { ArrowRight, Megaphone, Package, Users, type LucideIcon } from "lucide-react";

const LINKS: { label: string; text: string; href: string; icon: LucideIcon }[] = [
  { label: "User management", text: "Find, review and support accounts", href: "/admin/users", icon: Users },
  { label: "Products", text: "Manage plans, prices and availability", href: "/admin/products", icon: Package },
  { label: "Announcement", text: "Post a notice to all users", href: "/admin/announcements", icon: Megaphone },
];

export function AdminQuickLinks() {
  return (
    <section aria-labelledby="admin-manage">
      <h2 id="admin-manage" className="mb-3 font-[family-name:var(--font-display)] text-lg font-bold">
        Manage
      </h2>

      <ul className="grid gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10 sm:grid-cols-3">
        {LINKS.map(({ label, text, href, icon: Icon }) => (
          <li key={href} className="bg-white dark:bg-[#0B1B1F]">
            <Link
              href={href}
              className="group flex h-full items-center gap-4 px-5 py-5 outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#12343B] dark:hover:bg-white/5 dark:focus-visible:ring-[#F2B632]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gray-100 text-[#12343B] transition-colors group-hover:bg-[#F2B632] dark:bg-white/10 dark:text-[#EEF3F4] dark:group-hover:text-[#12343B]">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-gray-600 dark:text-[#9FB3B7]">{text}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
