import { Calculator, LayoutDashboard, Megaphone, Network, Package, Receipt, Users } from "lucide-react";
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
          { label: "Bills", href: "/admin/products/bills", permission: "products.view" },
          { label: "Exam", href: "/admin/products/exam", permission: "products.view" },
        ],
      },
      {
        label: "Announcement",
        href: "/admin/announcements",
        icon: Megaphone,
        permission: "announcements.manage",
      },
    ],
  },
  {
    id: "admin-gateways",
    label: "Gateways",
    items: [
      { label: "Providers", href: "/admin/gateways/providers", icon: Network, permission: "gateways.manage" },
    ],
  },
  {
    id: "admin-transactions",
    label: "Transactions",
    items: [
      { label: "History", href: "/admin/transactions", icon: Receipt, permission: "transactions.view" },
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
