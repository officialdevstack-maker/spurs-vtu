import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { formatWhen } from "@/lib/format";
import { listCustomers, type CustomerStatus } from "@/lib/db/customers";
import { CustomerStatusButton } from "./customer-status-button";

export const metadata: Metadata = { title: "Customers | Spur VTU" };

const PAGE_SIZE = 25;

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  page?: string | string[];
};

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function pageNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(page: number, query: string, status: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  params.set("page", String(page));
  return `/admin/users/list?${params.toString()}`;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  await requirePermission("customers.view");
  const params = await searchParams;
  const query = single(params.q).trim().slice(0, 100);
  const requestedStatus = single(params.status);
  const status: CustomerStatus | "all" =
    requestedStatus === "active" || requestedStatus === "suspended" ? requestedStatus : "all";
  const requestedPage = pageNumber(single(params.page));
  const { customers, total, page: currentPage } = await listCustomers({
    query,
    status,
    page: requestedPage,
    pageSize: PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Customers</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Find, review and manage customer account status.
        </p>
      </header>

      <form method="get" className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-100 p-4 sm:flex-row dark:border-white/10 dark:bg-white/5">
        <label className="sr-only" htmlFor="customer-search">Search customers</label>
        <input
          id="customer-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search name, username or email"
          className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]"
        />
        <label className="sr-only" htmlFor="customer-status">Filter by status</label>
        <select
          id="customer-status"
          name="status"
          defaultValue={status}
          className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button type="submit" className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] hover:bg-[#E5A720]">
          Search
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {customers.length === 0 ? (
          <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">
            {total === 0 ? "No customers found." : "No customers on this page."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                <tr>
                  <th scope="col" className="px-5 py-3">Customer</th>
                  <th scope="col" className="px-5 py-3">Email</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">Joined</th>
                  <th scope="col" className="px-5 py-3">Last seen</th>
                  <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium">{customer.name || customer.username || "Unnamed customer"}</p>
                      {customer.username ? (
                        <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">@{customer.username}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">{customer.email || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        customer.status === "active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300"
                          : "bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-300"
                      }`}>
                        {customer.status === "active" ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">{formatWhen(customer.createdAt)}</td>
                    <td className="px-5 py-4 whitespace-nowrap">{formatWhen(customer.lastSeenAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <CustomerStatusButton
                        customerId={customer.id}
                        customerName={customer.name || customer.username || customer.email || "this customer"}
                        status={customer.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:text-[#9FB3B7]">
          <p>
            {total === 0 ? "0 customers" : `${start}–${end} of ${total} customers`}
          </p>
          <nav aria-label="Customer pages" className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10" href={pageHref(currentPage - 1, query, status)}>
                Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-gray-200 px-3 py-2 opacity-50 dark:border-white/10">Previous</span>
            )}
            <span aria-current="page" className="px-2">Page {currentPage} of {pageCount}</span>
            {currentPage < pageCount ? (
              <Link className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10" href={pageHref(currentPage + 1, query, status)}>
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-gray-200 px-3 py-2 opacity-50 dark:border-white/10">Next</span>
            )}
          </nav>
        </div>
      </section>
    </div>
  );
}
