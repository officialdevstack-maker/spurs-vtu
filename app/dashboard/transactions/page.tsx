import type { Metadata } from "next";
import { connection } from "next/server";
import { requireSpursUser } from "@spurs-cloud/accounts/next";
import { HistoryFilters, HistoryList, HistoryPagination } from "@/components/transactions/history-list";
import { listCustomerTransactions } from "@/lib/db/transactions";
import { HISTORY_PAGE_SIZE, parseHistoryParams, type HistoryParams } from "@/lib/transactions-history";

export const metadata: Metadata = { title: "Transactions | Spur VTU" };

const PATH = "/dashboard/transactions";

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<HistoryParams> }) {
  await connection();
  const user = await requireSpursUser();
  const query = parseHistoryParams(await searchParams);
  const { items, total, page } = await listCustomerTransactions(user.sub, { ...query, pageSize: HISTORY_PAGE_SIZE });
  const filtered = !!query.query || query.status !== "all" || query.service !== "all";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Everything you&apos;ve bought and every wallet top-up, newest first.
        </p>
      </header>

      <HistoryFilters basePath={PATH} query={query} />
      <HistoryList items={items} filtered={filtered} />
      <HistoryPagination basePath={PATH} query={{ ...query, page }} page={page} total={total} />
    </div>
  );
}
