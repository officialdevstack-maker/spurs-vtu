"use client";

import { useTransition } from "react";
import { markAllRead } from "@/app/dashboard/notifications/actions";

export function MarkReadButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await markAllRead()))}
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
    >
      {pending ? "Marking..." : "Mark all as read"}
    </button>
  );
}
