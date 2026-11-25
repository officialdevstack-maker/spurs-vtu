import { Calculator, CreditCard, LayoutDashboard, Megaphone, Network, Package, Receipt, Users, Webhook } from "lucide-react";
import type { Permission } from "@/lib/admin/permissions";
import type { NavGroup } from "@/lib/nav";

export const ADMIN_NAV: NavGroup[] = [
  {
    id: "admin-overview",
    label: "Overview",
    items: [{ label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true }],
  },
  {
    id: "admin-management",
    label: "Management",
    items: [
      {
        label: "User management",
        href: "/admin/users",
        icon: Users,
        children: [
          { label: "Customers", href: "/admin/users/list", permission: "customers.view" },
          { label: "Packages", href: "/admin/users/packages", permission: "packages.manage" },
          { label: "Roles & permissions", href: "/admin/users/roles", permission: "roles.manage" },
        ],
      },
      {
        label: "Products",
        href: "/admin/products",
        icon: Package,
        children: [
          { label: "Airtime & Data", href: "/admin/products/airtime-data", permission: "products.view" },
          { label: "Cable TV", href: "/admin/products/cable-tv", permission: "products.view" },
          { label: "Electricity", href: "/admin/products/electricity", permission: "products.view" },
          { label: "Exam", href: "/admin/products/exam", permission: "products.view" },
        ],
      },
      {
        label: "Announcement",
        href: "/admin/announcements",
        icon: Megaphone,
        children: [
          { label: "Welcome message", href: "/admin/announcements/welcome", permission: "announcements.manage" },
          { label: "Broadcast", href: "/admin/announcements/broadcast", permission: "announcements.manage" },
        ],
      },
    ],
  },
  {
    id: "admin-gateways",
    label: "Gateways",
    items: [
      { label: "Providers", href: "/admin/gateways/providers", icon: Network, permission: "gateways.manage" },
      { label: "Payment", href: "/admin/gateways/payment", icon: CreditCard, permission: "gateways.manage" },
      { label: "Webhooks", href: "/admin/gateways/webhooks", icon: Webhook, permission: "settings.manage" },
    ],
  },
  {
    id: "admin-transactions",
    label: "Transactions",
    items: [
      { label: "History", href: "/admin/transactions/list", icon: Receipt, permission: "transactions.view" },
      { label: "Calculator", href: "/admin/transactions/calculator", icon: Calculator, permission: "transactions.view" },
    ],
  },
];

export function filterNav(nav: NavGroup[], can: (permission: Permission) => boolean): NavGroup[] {
  return nav
    .map((group) => ({
      ...group,
      items: group.items.flatMap((item) => {
        if (item.children) {
          const children = item.children.filter((child) => !child.permission || can(child.permission));
          return children.length > 0 ? [{ ...item, children }] : [];
        }
        return !item.permission || can(item.permission) ? [item] : [];
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function firstAccessiblePath(can: (permission: Permission) => boolean): string | null {
  for (const group of filterNav(ADMIN_NAV, can)) {
    for (const item of group.items) {
      const target = item.children?.[0]?.href ?? item.href;
      if (target !== "/admin") return target;
    }
  }
  return null;
}
