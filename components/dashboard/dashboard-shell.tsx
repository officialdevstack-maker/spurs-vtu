"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sidebar, Wordmark, type SidebarUser } from "./sidebar";

const COLLAPSED_KEY = "spur-sidebar-collapsed";

export function DashboardShell({
  user,
  unreadCount,
  children,
}: {
  user: SidebarUser;
  unreadCount?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Width changes animate only after the saved state has been restored.
  const [ready, setReady] = useState(false);

  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {}
    setReady(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, current ? "0" : "1");
      } catch {}
      return !current;
    });
  }

  // Close the drawer after navigating.
  useEffect(() => setOpen(false), [pathname]);

  // Close and hand focus back to the button that opened the drawer.
  const closeDrawer = useCallback(() => {
    setOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // While the drawer is open: Escape closes it and the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, closeDrawer]);

  // Keep keyboard and screen-reader users inside the open drawer.
  useEffect(() => {
    contentRef.current?.toggleAttribute("inert", open);
  }, [open]);

  // If the window grows past the mobile breakpoint, drop the drawer state.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => query.matches && setOpen(false);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      style={{ "--sidebar-w": collapsed ? "4.5rem" : "18rem" } as CSSProperties}
      className={`min-h-dvh bg-white text-[#12343B] dark:bg-[#0B1B1F] dark:text-[#EEF3F4] lg:grid lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] ${
        ready ? "lg:transition-[grid-template-columns] lg:duration-200 motion-reduce:transition-none" : ""
      }`}
    >
      {/* Backdrop, mobile only */}
      <div
        aria-hidden="true"
        onClick={closeDrawer}
        className={`fixed inset-0 z-40 bg-[#0B1B1F]/60 transition-opacity motion-reduce:transition-none lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <Sidebar
        user={user}
        unreadCount={unreadCount}
        open={open}
        collapsed={collapsed}
        onClose={closeDrawer}
        onNavigate={() => setOpen(false)}
        onToggleCollapsed={toggleCollapsed}
      />

      <div ref={contentRef} className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur dark:border-white/10 dark:bg-[#0B1B1F]/90 lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="grid size-10 place-items-center rounded-lg outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:hover:bg-white/10 dark:focus-visible:ring-[#F2B632]"
          >
            <Menu className="size-6" />
          </button>
          <Wordmark />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}