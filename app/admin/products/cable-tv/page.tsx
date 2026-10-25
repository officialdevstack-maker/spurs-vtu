import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { CableTVManager } from "@/components/admin/cable-tv/manager";
import { getCableOperators } from "@/lib/db/cable";

export const metadata: Metadata = { title: "Cable TV | Spur VTU" };

export default async function CableTVPage({
  searchParams,
}: {
  searchParams: Promise<{ operator?: string }>;
}) {
  await connection();
  await requirePermission("products.view");
  const { operator } = await searchParams;
  const operators = await getCableOperators();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Cable TV</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Manage cable operators and bouquet pricing for customer purchases.
        </p>
      </header>

      <CableTVManager operators={operators} initialOperator={operator} />
    </div>
  );
}
