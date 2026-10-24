"use client";

import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { SidebarUser } from "@/components/dashboard/sidebar";
import { ADMIN_NAV } from "@/lib/admin/nav";

export function AdminShell({ user, children }: { user: SidebarUser; children: ReactNode }) {
  return (
    <DashboardShell
      user={user}
      nav={ADMIN_NAV}
      brandSuffix="Admin"
      modeSwitch={{ href: "/dashboard", label: "Switch to user" }}
      showNotifications={false}
    >
      {children}
    </DashboardShell>
  );
}
