import type { ReactNode } from "react";
import { after } from "next/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { syncCustomer } from "@/lib/db/customers";
import { getStaffAccess } from "@/lib/db/roles";
import { claimWelcome, getUnreadCount } from "@/lib/db/announcements";
import { sendWelcome } from "@/lib/broadcast";
import { requireSpursUser } from "@/lib/spurs";

export async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireSpursUser();
  try {
    await syncCustomer({
      ...user,
      phone: "phone_number" in user && typeof user.phone_number === "string" ? user.phone_number : undefined,
    });
  } catch (error) {
    console.error("Could not sync signed-in customer.", error);
  }
  let isStaff = false;
  try {
    isStaff = (await getStaffAccess(user.sub)) !== null;
  } catch (error) {
    console.error("Could not check staff access.", error);
  }
  const username = "username" in user && typeof user.username === "string" ? user.username : undefined;

  try {
    const welcome = await claimWelcome(user.sub);
    if (welcome) after(() => sendWelcome(welcome));
  } catch (error) {
    console.error("Could not start welcome message.", error);
  }

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadCount(user.sub);
  } catch (error) {
    console.error("Could not load unread count.", error);
  }

  return (
    <DashboardShell
      user={{
        name: user.name ?? "Spurs user",
        username,
        email: user.email,
        picture: user.picture,
      }}
      unreadCount={unreadCount}
      switchTo={isStaff ? "admin" : undefined}
    >
      {children}
    </DashboardShell>
  );
}
