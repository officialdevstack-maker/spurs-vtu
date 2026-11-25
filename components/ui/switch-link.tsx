import Link from "next/link";
import { LayoutDashboard, Shield } from "lucide-react";

const DESTINATIONS = {
  admin: { href: "/admin", icon: Shield, label: "Admin panel" },
  user: { href: "/dashboard", icon: LayoutDashboard, label: "Customer dashboard" },
} as const;

export function SwitchLink({
  to,
  collapsed = false,
  onNavigate,
}: {
  to: keyof typeof DESTINATIONS;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { href, icon: Icon, label } = DESTINATIONS[to];
  const accessibleLabel = `Switch to ${label}`;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? accessibleLabel : undefined}
      aria-label={collapsed ? accessibleLabel : undefined}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/10 dark:hover:bg-white/10 dark:focus-visible:ring-[#F2B632] lg:group-data-[collapsed=true]/side:justify-center lg:group-data-[collapsed=true]/side:px-0"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="lg:group-data-[collapsed=true]/side:sr-only">{accessibleLabel}</span>
    </Link>
  );
}
