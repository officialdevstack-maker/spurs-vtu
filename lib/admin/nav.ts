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
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Announcement", href: "/admin/announcements", icon: Megaphone },
    ],
  },
];
