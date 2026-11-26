"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BODY_LIMIT } from "@/lib/admin/support";

type Send = (body: string) => Promise<{ ok: true } | { ok: false; error: string }>;

export function ReplyForm({ send }: { send: Send }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await send(body);
        if (!result.ok) return setError(result.error);
        setBody("");
        router.refresh();
      } catch {
        setError("Could not send your message. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="reply" className="sr-only">Your reply</label>
      <textarea
        id="reply" value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_LIMIT} rows={4}
        className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]"
        placeholder="Write a reply"
      />
      {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
      <button type="submit" disabled={isPending || !body.trim()}
        className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] hover:bg-[#E5A720] disabled:opacity-50">
        {isPending ? "Sending..." : "Send reply"}
      </button>
    </form>
  );
}
