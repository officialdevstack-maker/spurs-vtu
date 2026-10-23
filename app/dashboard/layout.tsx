import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getSpursUser } from "@spurs-cloud/accounts/next";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // TODO: load the signed-in user from your session and redirect("/login") if
  // there isn't one. Placeholder data below.
  // const user = { name: "Jane Doe", email: "jane@example.com", picture: null };
  const user = await getSpursUser()
  const unreadCount = 3;

  return (
    <DashboardShell user={user as any} unreadCount={unreadCount}>
      {children}
    </DashboardShell>
  );
}