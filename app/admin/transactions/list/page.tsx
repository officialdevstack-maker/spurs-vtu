import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { HistoryFilters, HistoryList, HistoryPagination } from "@/components/transactions/history-list";
import { listAdminTransactions } from "@/lib/db/transactions";
import { HISTORY_PAGE_SIZE, parseHistoryParams, type HistoryParams } from "@/lib/transactions-history";

export const metadata: Metadata = { title: "Transaction history | Spur VTU" };

const PATH = "/admin/transactions";

export default async function TransactionHistoryPage({ searchParams }: { searchParams: Promise<HistoryParams> }) {
  await connection();
  await requirePermission("transactions.view");
  const query = parseHistoryParams(await searchParams);
  const { items, total, page } = await listAdminTransactions({ ...query, pageSize: HISTORY_PAGE_SIZE });
  const filtered = !!query.query || query.status !== "all" || query.service !== "all";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Review transactions across customer accounts. Search by username, email, number or reference.
        </p>
      </header>

      <HistoryFilters basePath={PATH} query={query} />
      <HistoryList items={items} admin filtered={filtered} />
      <HistoryPagination basePath={PATH} query={{ ...query, page }} page={page} total={total} />
    </div>
  );
}
