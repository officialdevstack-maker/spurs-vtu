import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { listOpenReconciliation } from "@/lib/db/reconciliation";
import { formatNaira, formatWhen } from "@/lib/format";
import { ReconciliationActions } from "./reconciliation-actions";

export const metadata: Metadata = { title: "Reconciliation | Spur VTU" };

export default async function ReconciliationPage() {
  await connection();
  await requirePermission("settings.manage");
  const items = await listOpenReconciliation();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Reconciliation</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Review late deliveries and pending orders that need a manual decision.</p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">No open reconciliation items.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                <tr>
                  <th scope="col" className="px-5 py-3">Order</th>
                  <th scope="col" className="px-5 py-3">Customer</th>
                  <th scope="col" className="px-5 py-3">Amount</th>
                  <th scope="col" className="px-5 py-3">Provider</th>
                  <th scope="col" className="px-5 py-3">Kind</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {items.map((item) => (
                  <tr key={item.id} className="align-middle">
                    <td className="px-5 py-4">
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 break-all font-mono text-xs text-gray-600 dark:text-[#9FB3B7]">{item.transactionId}</p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">{formatWhen(item.at)}</p>
                    </td>
                    <td className="px-5 py-4">{item.customer}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-medium">{formatNaira(item.amount)}</td>
                    <td className="px-5 py-4">{item.providerName ?? "Unknown"}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold dark:bg-white/10">
                        {item.kind === "late_success" ? "Late success" : "Stuck pending"}
                      </span>
                    </td>
                    <td className="px-5 py-4"><ReconciliationActions id={item.id} kind={item.kind} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
