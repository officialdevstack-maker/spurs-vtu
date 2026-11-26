import type { Metadata } from "next";
import { connection } from "next/server";
import { BalanceManager } from "@/components/admin/balances/manager";
import { requirePermission } from "@/lib/admin/auth";
import { listAllBalances } from "@/lib/db/balances";

export const metadata: Metadata = { title: "Provider balances | Spur VTU" };

export default async function ProviderBalancesPage() {
  await connection();
  await requirePermission("gateways.manage");
  const items = await listAllBalances();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Provider balances</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Track wallet balances and set low-balance alerts for each provider.
        </p>
      </header>
      <BalanceManager items={items} />
    </div>
  );
}
