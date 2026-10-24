import { CreditCard, LayoutDashboard, Megaphone, Network, Package, Users } from "lucide-react";
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
      { label: "User management", href: "/admin/users", icon: Users },
      {
        label: "Products",
        href: "/admin/products",
        icon: Package,
        children: [
          { label: "Airtime & Data", href: "/admin/products/airtime-data" },
          { label: "Cable TV", href: "/admin/products/cable-tv" },
          { label: "Bills", href: "/admin/products/bills" },
          { label: "Exam", href: "/admin/products/exam" },
        ],
      },
      { label: "Announcement", href: "/admin/announcements", icon: Megaphone },
    ],
  },
  {
    id: "admin-gateways",
    label: "Gateways",
    items: [
      { label: "Providers", href: "/admin/gateways/providers", icon: Network },
      { label: "Payment", href: "/admin/gateways/payment", icon: CreditCard },
    ],
  },
];
