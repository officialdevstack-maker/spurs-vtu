import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { ReplyForm } from "@/components/support/reply-form";
import { TicketThread } from "@/components/support/ticket-thread";
import { CloseTicketButton } from "@/components/support/close-ticket-button";
import { STATUS_LABEL } from "@/lib/admin/support";
import { getTicket } from "@/lib/db/support";
import { formatNaira } from "@/lib/format";
import { requireSpursUser } from "@/lib/spurs";
import { closeMyTicket, replyToTicket } from "../actions";

export const metadata: Metadata = { title: "Support ticket | Spur VTU" };
export const instant = false;

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await requireSpursUser();
  const { id } = await params;
  const ticket = await getTicket(id, user.sub);
  if (!ticket) notFound();
  const closed = ticket.status === "closed";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/dashboard/support" className="inline-flex items-center gap-2 rounded text-sm font-medium underline-offset-4 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> Support
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">{STATUS_LABEL[ticket.status].customer}</p>
        {ticket.transaction && (
          <p className="mt-1 text-sm">
            About:{" "}
            <Link href={`/dashboard/transactions/${encodeURIComponent(ticket.transaction.id)}`} className="font-medium underline underline-offset-4">
              {ticket.transaction.title} ({formatNaira(ticket.transaction.amount)})
            </Link>
          </p>
        )}
      </header>
      <TicketThread messages={ticket.messages} viewer="customer" />
      {closed ? (
        <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">This ticket is closed. Open a new ticket if you still need help.</p>
      ) : (
        <>
          <ReplyForm send={replyToTicket.bind(null, ticket.id)} />
          <CloseTicketButton close={closeMyTicket.bind(null, ticket.id)} />
        </>
      )}
    </div>
  );
}
