"use client";

import { useEffect, useState, type RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, User, type LucideIcon } from "lucide-react";
import { NAV } from "@/lib/nav";
import { Wordmark } from "@/components/dashboard/sidebar";

const MORE: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
];

const EXTRA_TITLES: Record<string, string> = {
  "/dashboard/profile": "Profile",
  "/dashboard/notifications": "Notifications",
};

function titleFor(pathname: string): string {
  const items = NAV.flatMap((group) => group.items.flatMap((item) => [item, ...(item.children ?? [])]));
  const match = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? EXTRA_TITLES[pathname] ?? "";
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";

const focus = "outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]";

export function AccountBarView({
  name,
  username,
  email,
  picture,
  unread,
  menuButtonRef,
  menuOpen,
  onOpenMenu,
  brandSuffix,
}: {
  name: string;
  username: string | null;
  email: string;
  picture: string | null;
  unread: number;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  menuOpen: boolean;
  onOpenMenu: () => void;
  brandSuffix?: string;
}) {
  const pathname = usePathname();
  const [openForPathname, setOpenForPathname] = useState<string | null>(null);
  const open = openForPathname === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenForPathname(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const badge = unread > 99 ? "99+" : String(unread);
  const actions = (
    <div className="flex items-center gap-1">
      <Link
        href="/dashboard/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className={`relative grid size-10 place-items-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 ${focus}`}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 min-w-4 rounded-full bg-[#F2B632] px-1 text-center text-[10px] font-bold leading-4 text-[#12343B]"
          >
            {badge}
          </span>
        )}
      </Link>

      <button
        type="button"
        onClick={() => setOpenForPathname((current) => (current === pathname ? null : pathname))}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`grid size-10 place-items-center overflow-hidden rounded-full bg-[#F2B632] text-sm font-bold text-[#12343B] ${focus}`}
      >
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          initials(name)
        )}
      </button>
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur dark:border-white/10 dark:bg-[#0B1B1F]/90 lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className={`grid size-10 place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 ${focus}`}
        >
          <Menu className="size-6" aria-hidden="true" />
        </button>
        <Wordmark textClassName="text-lg" suffix={brandSuffix} />
        <div className="ml-auto">{actions}</div>
      </header>

      <div className="sticky top-0 z-30 hidden h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white/90 px-6 backdrop-blur dark:border-white/10 dark:bg-[#0B1B1F]/90 sm:px-6 lg:flex lg:px-8">
        <p className="truncate font-[family-name:var(--font-display)] text-lg font-bold">{titleFor(pathname)}</p>
        {actions}
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close account menu"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpenForPathname(null)}
          />
          <div
            role="dialog"
            aria-label="Account"
            className="fixed right-4 top-16 z-50 w-72 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#10262B] sm:right-6 lg:right-8"
          >
            <div className="px-3 py-3">
              <p className="truncate font-semibold">{name}</p>
              {username && <p className="truncate text-sm text-gray-600 dark:text-[#9FB3B7]">@{username}</p>}
              {email && <p className="truncate text-sm text-gray-600 dark:text-[#9FB3B7]">{email}</p>}
            </div>
            <ul className="border-t border-gray-200 pt-2 dark:border-white/10">
              {MORE.map(({ label, href, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/10 ${focus}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                    {href.endsWith("notifications") && unread > 0 && (
                      <span className="ml-auto rounded-full bg-[#F2B632] px-2 py-0.5 text-xs font-semibold text-[#12343B]">
                        {badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
