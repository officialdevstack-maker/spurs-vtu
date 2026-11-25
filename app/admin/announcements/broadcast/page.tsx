import type { Metadata } from "next";
import { connection } from "next/server";
import { BroadcastManager } from "@/components/admin/announcements/broadcast-manager";
import { requirePermission } from "@/lib/admin/auth";
import { listBroadcasts } from "@/lib/db/announcements";
import { listPackages } from "@/lib/db/packages";
import { channelAvailability } from "@/lib/messaging/send";

export const metadata: Metadata = { title: "Broadcast | Spur VTU" };

export default async function BroadcastPage() {
  await connection();
  await requirePermission("announcements.manage");
  const [history, packages] = await Promise.all([listBroadcasts(), listPackages()]);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Broadcast</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Send a message to your customers by in-app notification, email or SMS.</p>
      </header>
      <BroadcastManager
        history={history}
        availability={channelAvailability()}
        packages={packages.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
