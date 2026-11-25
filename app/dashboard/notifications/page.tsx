import type { Metadata } from "next";
import { connection } from "next/server";
import { Bell } from "lucide-react";
import { MarkReadButton } from "@/components/dashboard/mark-read-button";
import { listNotifications } from "@/lib/db/announcements";
import { formatWhen } from "@/lib/format";
import { requireSpursUser } from "@/lib/spurs";

export const metadata: Metadata = { title: "Notifications | Spur VTU" };
export const instant = false;

export default async function NotificationsPage() {
  await connection();
  const user = await requireSpursUser();
  const items = await listNotifications(user.sub);
  const hasUnread = items.some((item) => !item.read);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Updates and announcements from Spur VTU.</p>
        </div>
        {hasUnread && <MarkReadButton />}
      </header>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <Bell className="mx-auto size-8 text-gray-400" aria-hidden="true" />
          <p className="mt-3 font-medium">You&apos;re all caught up</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">New announcements will show up here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 px-5 py-4">
              <span aria-hidden="true" className={`mt-2 size-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-[#F2B632]"}`} />
              <div className="min-w-0">
                <p className="font-semibold">
                  {item.title}
                  {!item.read && <span className="sr-only"> (unread)</span>}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-[#9FB3B7]">{item.body}</p>
                <p className="mt-2 text-xs text-gray-600 dark:text-[#9FB3B7]">{formatWhen(item.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
