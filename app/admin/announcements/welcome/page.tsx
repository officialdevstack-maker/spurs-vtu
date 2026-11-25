import type { Metadata } from "next";
import { connection } from "next/server";
import { WelcomeManager } from "@/components/admin/announcements/welcome-manager";
import { requirePermission } from "@/lib/admin/auth";
import { getWelcomeTemplates } from "@/lib/db/announcements";
import { channelAvailability } from "@/lib/messaging/send";

export const metadata: Metadata = { title: "Welcome message | Spur VTU" };

export default async function WelcomeMessagePage() {
  await connection();
  await requirePermission("announcements.manage");
  const templates = await getWelcomeTemplates();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Welcome message</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Sent once to each new customer the first time they open their dashboard.</p>
      </header>
      <WelcomeManager templates={templates} availability={channelAvailability()} />
    </div>
  );
}
