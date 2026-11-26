import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/admin/auth";
import { SUPPORT_PATH, STATUS_LABEL } from "@/lib/admin/support";
import { getTicket } from "@/lib/db/support";
import { formatNaira } from "@/lib/format";
import { TicketThread } from "@/components/support/ticket-thread";
import { ReplyForm } from "@/components/support/reply-form";
import { AdminStatusButton } from "@/components/support/admin-status-button";
import { staffReply, staffSetStatus } from "../actions";

export const metadata: Metadata = { title: "Support ticket | Spur VTU" };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requirePermission("support.manage");
  const { id } = await params;
  const ticket = await getTicket(id, null);
  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link href={SUPPORT_PATH} className="inline-flex items-center gap-2 rounded text-sm font-medium underline-offset-4 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> Support tickets
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">{STATUS_LABEL[ticket.status].admin}</p>
      </header>

      <aside className="grid gap-3 rounded-2xl border border-gray-200 p-5 text-sm sm:grid-cols-2 dark:border-white/10">
        <div>
          <p className="font-medium">Customer</p>
          <p>{ticket.customer.label}</p>
          {ticket.customer.email && <p className="text-gray-600 dark:text-[#9FB3B7]">{ticket.customer.email}</p>}
          {ticket.customer.phone && <p className="text-gray-600 dark:text-[#9FB3B7]">{ticket.customer.phone}</p>}
        </div>
        <div>
          <p className="font-medium">Linked transaction</p>
          {ticket.transaction ? (
            <p className="text-gray-600 dark:text-[#9FB3B7]">
              {ticket.transaction.title} · {formatNaira(ticket.transaction.amount)} · {ticket.transaction.status}<br />
              <span className="break-all font-mono text-xs">{ticket.transaction.id}</span>
            </p>
          ) : (
            <p className="text-gray-600 dark:text-[#9FB3B7]">None</p>
          )}
        </div>
      </aside>

      <TicketThread messages={ticket.messages} viewer="admin" />
      <ReplyForm send={staffReply.bind(null, ticket.id)} />
      <AdminStatusButton
        status={ticket.status === "closed" ? "open" : "closed"}
        setStatus={staffSetStatus.bind(null, ticket.id, ticket.status === "closed" ? "open" : "closed")}
      />
    </div>
  );
}
