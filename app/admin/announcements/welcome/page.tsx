import type { Metadata } from "next";
import { connection } from "next/server";
import { WelcomeManager } from "@/components/admin/announcements/welcome-manager";
import { requirePermission } from "@/lib/admin/auth";
import { getWelcomePopup } from "@/lib/db/announcements";

export const metadata: Metadata = { title: "Welcome message | Spur VTU" };

export default async function WelcomeMessagePage() {
  await connection();
  await requirePermission("announcements.manage");
  const popup = await getWelcomePopup();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Welcome message</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">A popup customers see on their dashboard until they dismiss it.</p>
      </header>
      <WelcomeManager templates={templates} availability={channelAvailability()} />
    </div>
  );
}
