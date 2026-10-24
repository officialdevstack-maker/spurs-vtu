import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Transaction history | Spur VTU" };

export default async function TransactionHistoryPage() {
  await connection();
  await requirePermission("transactions.view");
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Review transactions across customer accounts.</p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-gray-100 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="font-semibold">Transaction history is coming soon</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Search, filter and review transaction details here.
        </p>
      </section>
    </div>
  );
}
