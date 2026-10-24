"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { SidebarUser } from "@/components/dashboard/sidebar";
import { ADMIN_NAV, filterNav } from "@/lib/admin/nav";

export function AdminShell({
  user,
  permissions,
  children,
}: {
  user: SidebarUser;
  permissions: string[];
  children: ReactNode;
}) {
  const nav = useMemo(() => {
    const granted = new Set(permissions);
    return filterNav(ADMIN_NAV, (permission) => granted.has(permission));
  }, [permissions]);

  return (
    <DashboardShell
      user={user}
      nav={nav}
      brandSuffix="Admin"
      showNotifications={false}
    >
      {children}
    </DashboardShell>
  );
}
