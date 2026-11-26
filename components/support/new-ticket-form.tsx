"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTicket } from "@/app/dashboard/support/actions";
import { BODY_LIMIT, SUBJECT_LIMIT } from "@/lib/admin/support";
import { formatNaira } from "@/lib/format";

const field =
  "w-full rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]";

export function NewTicketForm({
  transactions, defaultTransaction,
}: { transactions: { id: string; title: string; amount: number }[]; defaultTransaction: string }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [transactionId, setTransactionId] = useState(transactions.some((t) => t.id === defaultTransaction) ? defaultTransaction : "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await createTicket({ subject, body, transactionId: transactionId || null });
        if (!result.ok) return setError(result.error);
        router.push(`/dashboard/support/${result.id}`);
      } catch {
        setError("Could not send your ticket. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <div>
        <label htmlFor="subject" className="text-sm font-medium">Subject</label>
        <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUBJECT_LIMIT} className={`${field} mt-1 h-11`} />
      </div>
      <div>
        <label htmlFor="purchase" className="text-sm font-medium">Related purchase (optional)</label>
        <select id="purchase" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className={`${field} mt-1 h-11`}>
          <option value="">Not about a purchase</option>
          {transactions.map((t) => <option key={t.id} value={t.id}>{t.title} · {formatNaira(t.amount)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="message" className="text-sm font-medium">How can we help?</label>
        <textarea id="message" value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_LIMIT} rows={6} className={`${field} mt-1 p-3`} />
      </div>
      {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
      <button type="submit" disabled={isPending || !subject.trim() || !body.trim()}
        className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] hover:bg-[#E5A720] disabled:opacity-50">
        {isPending ? "Sending..." : "Send ticket"}
      </button>
    </form>
  );
}
