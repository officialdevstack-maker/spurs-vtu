import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { LifeBuoy } from "lucide-react";
import { STATUS_LABEL } from "@/lib/admin/support";
import { listCustomerTickets } from "@/lib/db/support";
import { formatWhen } from "@/lib/format";
import { requireSpursUser } from "@/lib/spurs";

export const metadata: Metadata = { title: "Support | Spur VTU" };
export const instant = false;

export default async function SupportPage() {
  await connection();
  const user = await requireSpursUser();
  const tickets = await listCustomerTickets(user.sub);
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Support</h1>
          <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Contact Spur VTU and keep track of replies.</p>
        </div>
        <Link href="/dashboard/support/new" className="h-11 rounded-xl bg-[#F2B632] px-5 py-3 text-sm font-semibold text-[#12343B] hover:bg-[#E5A720]">New ticket</Link>
      </header>
      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <LifeBuoy className="mx-auto size-8 text-gray-400" aria-hidden="true" />
          <p className="mt-3 font-medium">No support tickets</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Create a ticket if you need help.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link href={`/dashboard/support/${ticket.id}`} className="block px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium">{ticket.subject}</p>
                  <p className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600 dark:text-[#9FB3B7]">
                    <span className={`size-2 rounded-full ${ticket.status === "open" ? "bg-[#C8432B]" : ticket.status === "answered" ? "bg-[#F2B632]" : "bg-gray-400"}`} />
                    {STATUS_LABEL[ticket.status].customer}
                  </p>
                </div>
                <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">{formatWhen(ticket.at, now)} · {ticket.messages} messages</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
