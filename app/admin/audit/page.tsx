import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { AUDIT_PAGE_SIZE, AUDIT_PATH } from "@/lib/admin/audit";
import { listAudit } from "@/lib/db/audit";
import { formatWhen } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log | Spur VTU" };

type SearchParams = { q?: string | string[]; page?: string | string[] };
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

function href(page: number, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${AUDIT_PATH}?${qs}` : AUDIT_PATH;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  await requirePermission("audit.view");
  const params = await searchParams;
  const query = single(params.q).trim().slice(0, 100);
  const parsed = Number.parseInt(single(params.page), 10);
  const { items, total, page } = await listAudit({
    query,
    page: Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1,
    pageSize: AUDIT_PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Who changed what, and when. Entries can&apos;t be edited or deleted.
        </p>
      </header>

      <form method="get" className="flex gap-3 rounded-2xl border border-gray-200 bg-gray-100 p-4 dark:border-white/10 dark:bg-white/5">
        <label className="sr-only" htmlFor="audit-search">Search the audit log</label>
        <input
          id="audit-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search admin, action, target or summary"
          className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]"
        />
        <button type="submit" className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] hover:bg-[#E5A720]">
          Search
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">No entries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                <tr>
                  <th scope="col" className="px-5 py-3">When</th>
                  <th scope="col" className="px-5 py-3">Admin</th>
                  <th scope="col" className="px-5 py-3">Action</th>
                  <th scope="col" className="px-5 py-3">What happened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-3">{formatWhen(item.at)}</td>
                    <td className="px-5 py-3">{item.actor}</td>
                    <td className="px-5 py-3 font-mono text-xs">{item.action}</td>
                    <td className="px-5 py-3">
                      <p>{item.summary}</p>
                      {item.target && <p className="mt-1 break-all text-xs text-gray-600 dark:text-[#9FB3B7]">Target: {item.target}</p>}
                      {Object.keys(item.meta).length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-gray-600 dark:text-[#9FB3B7]">Details</summary>
                          <pre className="mt-1 overflow-x-auto rounded-lg bg-gray-100 p-2 text-xs dark:bg-white/10">
                            {JSON.stringify(item.meta, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 text-sm text-gray-600 dark:border-white/10 dark:text-[#9FB3B7]">
          <p>{total} entries</p>
          <nav aria-label="Audit pages" className="flex items-center gap-2">
            {page > 1 ? (
              <Link className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10" href={href(page - 1, query)}>Previous</Link>
            ) : (
              <span className="rounded-lg border border-gray-200 px-3 py-2 opacity-50 dark:border-white/10">Previous</span>
            )}
            <span aria-current="page" className="px-2">Page {page} of {pageCount}</span>
            {page < pageCount ? (
              <Link className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10" href={href(page + 1, query)}>Next</Link>
            ) : (
              <span className="rounded-lg border border-gray-200 px-3 py-2 opacity-50 dark:border-white/10">Next</span>
            )}
          </nav>
        </div>
      </section>
    </div>
  );
}
