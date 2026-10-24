import {
  Gift,
  LayoutDashboard,
  Receipt,
  Smartphone,
  Tv,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/admin/permissions";

export type NavChild = { label: string; href: string; exact?: boolean; permission?: Permission };
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  permission?: Permission;
  /** Sub-pages. The parent becomes an expandable row instead of a link. */
  children?: NavChild[];
};
export type NavGroup = { id: string; label: string; collapsible?: boolean; items: NavItem[] };

/** Edit routes and labels here; the sidebar renders whatever is in this list. */
export const NAV: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    id: "services",
    label: "Services",
    collapsible: true,
    items: [
      { label: "Airtime", href: "/dashboard/airtime", icon: Smartphone },
      { label: "Data", href: "/dashboard/data", icon: Wifi },
      { label: "Cable TV", href: "/cable-tv", icon: Tv },
      { label: "Electricity", href: "/electricity", icon: Zap },
    ],
  },
  {
    id: "finances",
    label: "Finances",
    items: [
      { label: "Fund wallet", href: "/fund-wallet", icon: Wallet },
      { label: "Transactions", href: "/dashboard/transactions", icon: Receipt },
      { label: "Bonus rewards", href: "/bonus", icon: Gift },
    ],
  },
];