"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { Bell, ChevronDown, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from "lucide-react";
import { NAV, type NavGroup } from "@/lib/nav";

export type SidebarUser = { name: string; username?: string; email?: string; picture?: string | null };

/**
 * Palette
 *   surface  gray-100   sidebar background
 *   ink      #12343B    text and focus rings
 *   gold     #F2B632    logo tile, active bar, unread badge, avatar
 *   green    #1E8E4F    active icon, "online" dot, current-section dot (#4CC38A in dark mode)
 */

// Rail (icon-only) styles. They only apply from `lg` up, so the mobile drawer
// is always full width. Kept as whole class strings so Tailwind can find them.
const R_HIDE = "lg:group-data-[collapsed=true]/side:hidden";
const R_SHOW = "lg:group-data-[collapsed=true]/side:block";
const R_SR = "lg:group-data-[collapsed=true]/side:sr-only";
const R_CENTER = "lg:group-data-[collapsed=true]/side:justify-center";
const R_NOPX = "lg:group-data-[collapsed=true]/side:px-0";
const R_PX3 = "lg:group-data-[collapsed=true]/side:px-3";
const R_ONECOL = "lg:group-data-[collapsed=true]/side:grid-cols-1";
const R_FLEX = "lg:group-data-[collapsed=true]/side:flex";

const GROUPS_KEY = "spur-nav-groups";
const ITEMS_KEY = "spur-nav-items";

export function Wordmark({ textClassName = "", suffix }: { textClassName?: string; suffix?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#F2B632] text-lg font-bold text-[#12343B]"
      >
        S
      </span>
      <span className={`text-xl font-bold tracking-tight ${textClassName}`}>
        Spur VTU
        {suffix && (
          <span className="ml-2 rounded-md bg-[#12343B] px-1.5 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-[#EEF3F4] dark:bg-[#F2B632] dark:text-[#12343B]">
            {suffix}
          </span>
        )}
      </span>
    </div>
  );
}

const iconButton =
  "relative grid h-10 w-full place-items-center rounded-lg bg-white text-gray-600 ring-1 ring-gray-200 outline-none transition-colors hover:text-[#12343B] hover:ring-gray-300 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:bg-white/5 dark:text-[#9FB3B7] dark:ring-white/10 dark:hover:text-white dark:focus-visible:ring-[#F2B632]";

export function Sidebar({
  user,
  unreadCount = 0,
  signOutHref = "/logout",
  notificationsHref = "/notifications",
  nav = NAV,
  brandSuffix,
  showNotifications = true,
  open,
  collapsed,
  onClose,
  onNavigate,
  onToggleCollapsed,
}: {
  user: SidebarUser;
  unreadCount?: number;
  signOutHref?: string;
  notificationsHref?: string;
  nav?: NavGroup[];
  brandSuffix?: string;
  showNotifications?: boolean;
  /** Mobile drawer state. Ignored on desktop, where the sidebar is always visible. */
  open: boolean;
  /** Desktop icon-only rail. Ignored on mobile. */
  collapsed: boolean;
  /** Close the drawer and return focus to the menu button. */
  onClose: () => void;
  /** Close the drawer after following a link (focus belongs to the new page). */
  onNavigate: () => void;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    pathname === href || (!exact && pathname.startsWith(`${href}/`));

  // Which collapsible groups the person has closed. Remembered across visits.
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      if (raw) setClosedGroups(JSON.parse(raw));
    } catch {}
  }, []);
  function toggleGroup(id: string) {
    setClosedGroups((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  // Which parent items (e.g. Products) the person has opened or closed. Remembered across visits.
  // Until toggled by hand, an item is open whenever one of its children is the current page.
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ITEMS_KEY);
      if (raw) setOpenItems(JSON.parse(raw));
    } catch {}
  }, []);
  function toggleItem(href: string, isOpen: boolean) {
    setOpenItems((current) => {
      const next = { ...current, [href]: !isOpen };
      try {
        localStorage.setItem(ITEMS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const linkClass = (active: boolean) =>
    `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632] ${R_CENTER} ${R_NOPX} ${
      active
        ? "bg-white font-medium shadow-sm ring-1 ring-gray-200 dark:bg-white/10 dark:ring-white/10"
        : "text-gray-600 hover:bg-gray-200/70 hover:text-[#12343B] dark:text-[#9FB3B7] dark:hover:bg-white/5 dark:hover:text-white"
    }`;

  // Theme toggle: flips the `dark` class on <html> and remembers the choice.
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  // Drawer: move focus inside when it opens.
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Drawer: swipe left to close.
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (open && touchStartX.current !== null && e.changedTouches[0].clientX - touchStartX.current < -60) onClose();
    touchStartX.current = null;
  };

  const initial = Array.from(user.name.trim())[0]?.toUpperCase() ?? "?";

  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={[
        "group/side flex flex-col border-r border-gray-200 bg-gray-100 text-[#12343B] dark:border-white/10 dark:bg-[#10262B] dark:text-[#EEF3F4]",
        // Desktop: pinned to the viewport. Stacks above the page so the edge handle isn't covered.
        "sticky top-0 z-20 h-dvh",
        // Mobile: off-canvas drawer. `invisible` keeps hidden links out of the tab order.
        "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-72 max-lg:shadow-2xl",
        "max-lg:transition-[transform,visibility] max-lg:duration-300 motion-reduce:transition-none",
        open ? "" : "max-lg:invisible max-lg:-translate-x-full",
      ].join(" ")}
    >
      <div className={`flex h-16 shrink-0 items-center justify-between px-5 ${R_CENTER} ${R_NOPX}`}>
        <Wordmark textClassName={R_HIDE} suffix={brandSuffix} />
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="grid size-9 place-items-center rounded-lg text-gray-500 outline-none hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:hover:bg-white/10 dark:focus-visible:ring-[#F2B632] lg:hidden"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Desktop only: collapse to an icon rail. Sits on the sidebar's edge. */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-[4.5rem] hidden size-6 place-items-center rounded-full bg-white text-gray-500 ring-1 ring-gray-200 outline-none hover:text-[#12343B] focus-visible:ring-2 focus-visible:ring-[#12343B] dark:bg-[#10262B] dark:ring-white/15 dark:hover:text-white dark:focus-visible:ring-[#F2B632] lg:grid"
      >
        {collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
      </button>

      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4 no-scrollbar">
        {nav.map((group, index) => {
          const closed = !!group.collapsible && !!closedGroups[group.id];
          const hasActive = group.items.some((item) => isActive(item.href, item.exact));
          const listId = `nav-${group.id}`;
          return (
            <div key={group.id}>
              {/* On the rail, group names give way to a thin divider. */}
              {index > 0 && <div aria-hidden="true" className={`mx-3 mb-3 hidden h-px bg-gray-200 dark:bg-white/10 ${R_SHOW}`} />}

              {group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!closed}
                  aria-controls={listId}
                  className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-sm font-medium text-gray-500 outline-none hover:text-[#12343B] focus-visible:ring-2 focus-visible:ring-[#12343B] dark:text-[#8FA5A9] dark:hover:text-white dark:focus-visible:ring-[#F2B632] ${R_HIDE}`}
                >
                  <span className="flex items-center gap-2">
                    {group.label}
                    {/* Closed group that contains the current page */}
                    {closed && hasActive && (
                      <>
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-[#1E8E4F] dark:bg-[#4CC38A]" />
                        <span className="sr-only">(contains current page)</span>
                      </>
                    )}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-4 transition-transform motion-reduce:transition-none ${closed ? "-rotate-90" : ""}`}
                  />
                </button>
              ) : (
                <p className={`mb-1 px-3 py-1 text-sm font-medium text-gray-500 dark:text-[#8FA5A9] ${R_HIDE}`}>{group.label}</p>
              )}

              {/* The rail always shows every icon, even for a group that is closed. */}
              <ul id={listId} hidden={closed} className={`space-y-0.5 ${R_SHOW}`}>
                {group.items.map((item) => {
                  const { label, href, icon: Icon, exact, children } = item;

                  // Plain link (no children)
                  if (!children?.length) {
                    const active = isActive(href, exact);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={onNavigate}
                          title={collapsed ? label : undefined}
                          aria-current={active ? "page" : undefined}
                          className={linkClass(active)}
                        >
                          {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r bg-[#F2B632]" />}
                          <Icon
                            aria-hidden="true"
                            className={`size-5 shrink-0 ${active ? "text-[#1E8E4F] dark:text-[#4CC38A]" : ""}`}
                          />
                          <span className={R_SR}>{label}</span>
                        </Link>
                      </li>
                    );
                  }

                  // Parent with children
                  const hasActive = isActive(href) || children.some((child) => isActive(child.href, child.exact));
                  const expanded = openItems[href] ?? hasActive;
                  const subId = `nav-sub-${href.replace(/\W+/g, "-")}`;
                  return (
                    <li key={href}>
                      {/* Full sidebar: toggles the sub-list */}
                      <button
                        type="button"
                        onClick={() => toggleItem(href, expanded)}
                        aria-expanded={expanded}
                        aria-controls={subId}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] outline-none transition-colors hover:bg-gray-200/70 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:hover:bg-white/5 dark:focus-visible:ring-[#F2B632] ${R_HIDE} ${
                          hasActive
                            ? "font-medium text-[#12343B] dark:text-white"
                            : "text-gray-600 hover:text-[#12343B] dark:text-[#9FB3B7] dark:hover:text-white"
                        }`}
                      >
                        <Icon
                          aria-hidden="true"
                          className={`size-5 shrink-0 ${hasActive ? "text-[#1E8E4F] dark:text-[#4CC38A]" : ""}`}
                        />
                        <span className="flex-1">{label}</span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`size-4 transition-transform motion-reduce:transition-none ${expanded ? "" : "-rotate-90"}`}
                        />
                      </button>

                      {/* Icon rail: no room for a sub-list, so the icon links to the parent page */}
                      <Link
                        href={href}
                        onClick={onNavigate}
                        title={label}
                        aria-current={isActive(href, true) ? "page" : undefined}
                        className={`hidden ${R_FLEX} ${linkClass(hasActive)}`}
                      >
                        {hasActive && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r bg-[#F2B632]" />}
                        <Icon
                          aria-hidden="true"
                          className={`size-5 shrink-0 ${hasActive ? "text-[#1E8E4F] dark:text-[#4CC38A]" : ""}`}
                        />
                        <span className="sr-only">{label}</span>
                      </Link>

                      <ul
                        id={subId}
                        hidden={!expanded}
                        className={`ml-[1.625rem] mt-0.5 space-y-0.5 border-l border-gray-200 pl-3 dark:border-white/10 ${R_HIDE}`}
                      >
                        {children.map((child) => {
                          const childActive = isActive(child.href, child.exact);
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={onNavigate}
                                aria-current={childActive ? "page" : undefined}
                                className={`relative flex items-center rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors hover:bg-gray-200/70 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:hover:bg-white/5 dark:focus-visible:ring-[#F2B632] ${
                                  childActive
                                    ? "font-medium text-[#12343B] dark:text-white"
                                    : "text-gray-600 hover:text-[#12343B] dark:text-[#9FB3B7] dark:hover:text-white"
                                }`}
                              >
                                {childActive && <span aria-hidden="true" className="absolute inset-y-1 left-0 w-1 rounded-r bg-[#F2B632]" />}
                                <span className="truncate">{child.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className={`shrink-0 space-y-3 border-t border-gray-200 p-4 dark:border-white/10 ${R_PX3}`}>
        <div className={`flex items-center gap-3 ${R_CENTER}`}>
          <span className="relative shrink-0">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-10 rounded-full object-cover" />
            ) : (
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-[#F2B632] font-bold text-[#12343B]">
                {initial}
              </span>
            )}
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[#1E8E4F] ring-2 ring-gray-100 dark:bg-[#4CC38A] dark:ring-[#10262B]"
            />
          </span>
          <div className={`min-w-0 ${R_HIDE}`}>
            <p className="truncate text-sm font-medium">{user.name}</p>
            {user.username && <p className="truncate text-xs text-gray-500 dark:text-[#8FA5A9]">@{user.username}</p>}
            {user.email && <p className="truncate text-xs text-gray-500 dark:text-[#8FA5A9]">{user.email}</p>}
          </div>
        </div>

        <div className={`grid ${showNotifications ? "grid-cols-3" : "grid-cols-2"} gap-2 ${R_ONECOL}`}>
          {showNotifications && (
            <Link
              href={notificationsHref}
              onClick={onNavigate}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              title="Notifications"
              className={iconButton}
            >
              <Bell className="size-5" aria-hidden="true" />
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#F2B632] px-1 text-[10px] font-bold leading-none text-[#12343B]"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={dark ? "Light mode" : "Dark mode"}
            className={iconButton}
          >
            {dark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
          </button>
          <a href={signOutHref} aria-label="Log out" title="Log out" className={iconButton}>
            <LogOut className="size-5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </aside>
  );
}