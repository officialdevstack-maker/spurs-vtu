import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireSpursUser } from "@spurs-cloud/accounts/next";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireSpursUser();
  const username = "username" in user && typeof user.username === "string" ? user.username : undefined;
  const unreadCount = 3;

  return (
    <DashboardShell
      user={{
        name: user.name ?? "Spurs user",
        username,
        email: user.email,
        picture: user.picture,
      }}
      unreadCount={unreadCount}
    >
      {children}
    </DashboardShell>
  );
}