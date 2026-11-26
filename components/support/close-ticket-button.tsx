"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function CloseTicketButton({ close }: { close: () => Promise<{ ok: boolean; error?: string }> }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await close();
      if (!result.ok) toast.error(result.error ?? "Could not close the ticket.");
      else router.refresh();
    });
  }

  return (
    <button type="button" onClick={submit} disabled={isPending}
      className="h-10 rounded-xl border border-gray-300 px-4 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10">
      {isPending ? "Closing..." : "Close ticket"}
    </button>
  );
}
