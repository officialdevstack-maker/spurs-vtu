import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { STATUS_LABEL, SUPPORT_PATH, type TicketStatus } from "@/lib/admin/support";
import { listAdminTickets } from "@/lib/db/support";
import { formatWhen } from "@/lib/format";

export const metadata: Metadata = { title: "Support tickets | Spur VTU" };

type SearchParams = { status?: string | string[]; q?: string | string[]; page?: string | string[] };
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

function href(page: number, status: TicketStatus | "all", query: string) {
  const params = new URLSearchParams();
  params.set("status", status);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `${SUPPORT_PATH}?${params}`;
}

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  await requirePermission("support.manage");
  const params = await searchParams;
  const rawStatus = single(params.status);
  const status: TicketStatus | "all" = rawStatus === "answered" || rawStatus === "closed" || rawStatus === "all" ? rawStatus : "open";
  const query = single(params.q).trim().slice(0, 100);
  const parsed = Number.parseInt(single(params.page), 10);
  const { items, total, page } = await listAdminTickets({
    status, query, page: Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1, pageSize: 25,
  });
  const pageCount = Math.max(1, Math.ceil(total / 25));
  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Support tickets</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Customer questions and service requests.</p>
      </header>
      <form method="get" className="flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-gray-100 p-4 dark:border-white/10 dark:bg-white/5">
        <label className="sr-only" htmlFor="support-search">Search support tickets</label>
        <input id="support-search" name="q" type="search" defaultValue={query} placeholder="Search subject or customer" className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm dark:border-white/15 dark:bg-[#10262B]" />
        <label className="sr-only" htmlFor="support-status">Status</label>
        <select id="support-status" name="status" defaultValue={status} className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#10262B]">
          <option value="open">Needs reply</option>
          <option value="answered">Waiting on customer</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
        <button type="submit" className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B]">Filter</button>
      </form>
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">No support tickets found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                <tr><th className="px-5 py-3">Subject</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Messages</th><th className="px-5 py-3">Last activity</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {items.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="px-5 py-3"><Link className="font-medium underline-offset-4 hover:underline" href={`${SUPPORT_PATH}/${ticket.id}`}>{ticket.subject}</Link></td>
                    <td className="px-5 py-3">{ticket.customer}</td>
                    <td className="px-5 py-3">{STATUS_LABEL[ticket.status].admin}</td>
                    <td className="px-5 py-3">{ticket.messages}</td>
                    <td className="whitespace-nowrap px-5 py-3">{formatWhen(ticket.at, now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 text-sm text-gray-600 dark:border-white/10 dark:text-[#9FB3B7]">
          <p>{total} tickets</p>
          <nav aria-label="Support pages" className="flex items-center gap-2">
            {page > 1 ? <Link className="rounded-lg border px-3 py-2" href={href(page - 1, status, query)}>Previous</Link> : <span className="rounded-lg border px-3 py-2 opacity-50">Previous</span>}
            <span>Page {page} of {pageCount}</span>
            {page < pageCount ? <Link className="rounded-lg border px-3 py-2" href={href(page + 1, status, query)}>Next</Link> : <span className="rounded-lg border px-3 py-2 opacity-50">Next</span>}
          </nav>
        </div>
      </section>
    </div>
  );
}
