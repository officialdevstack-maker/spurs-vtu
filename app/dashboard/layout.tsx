import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireSpursUser } from "@spurs-cloud/accounts/next";
import { syncCustomer } from "@/lib/db/customers";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireSpursUser();
  try {
    await syncCustomer({
      ...user,
      phone: "phone" in user && typeof user.phone === "string" ? user.phone : undefined,
    });
  } catch (error) {
    console.error("Could not sync signed-in customer.", error);
  }
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