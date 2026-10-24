import { LayoutDashboard, Megaphone, Package, Users } from "lucide-react";
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
          { label: "Airtime", href: "/admin/products/airtime" },
          { label: "Data", href: "/admin/products/data" },
          { label: "Cable TV", href: "/admin/products/cable-tv" },
          { label: "Bills", href: "/admin/products/bills" },
          { label: "Exam", href: "/admin/products/exam" },
        ],
      },
      { label: "Announcement", href: "/admin/announcements", icon: Megaphone },
    ],
  },
];
