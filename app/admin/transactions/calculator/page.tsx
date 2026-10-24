import type { Metadata } from "next";
import { connection } from "next/server";
import { SalesFilters, SalesReportView } from "@/components/admin/calculator/sales-report";
import { requirePermission } from "@/lib/admin/auth";
import { getSalesReport } from "@/lib/db/transactions";
import { formatDay, parseReportRange, type ReportParams } from "@/lib/sales-report";

export const metadata: Metadata = { title: "Sales calculator | Spur VTU" };

const PATH = "/admin/transactions/calculator";

export default async function TransactionCalculatorPage({ searchParams }: { searchParams: Promise<ReportParams> }) {
  await connection();
  await requirePermission("transactions.view");
  const range = parseReportRange(await searchParams);
  const report = await getSalesReport(range.from, range.to);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Calculator</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Services sold from {formatDay(range.from)} to {formatDay(range.to)}, in Lagos time.
        </p>
      </header>

      <SalesFilters basePath={PATH} range={range} />
      <SalesReportView report={report} />
    </div>
  );
}
