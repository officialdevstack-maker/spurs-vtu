import type { Metadata } from "next";
import { connection } from "next/server";
import { AdjustCashbackForm } from "@/components/admin/cashback/adjust-form";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { getCashbackLiability, listAdminCashbackLedger } from "@/lib/db/cashback";
import { formatNaira, formatWhen } from "@/lib/format";

export const metadata: Metadata = { title: "Cashback activity | Spur VTU" };

const LABEL = { earn: "Earned", spend: "Spent", restore: "Restored", referral: "Referral", adjust: "Adjusted" } as const;

export default async function CashbackActivityPage() {
  await connection();
  await requirePermission("products.view");
  const { permissions } = await getAdminAccess();
  const [entries, liability] = await Promise.all([listAdminCashbackLedger(), getCashbackLiability()]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Cashback activity</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Customers currently hold {formatNaira(liability)} in cashback. Latest 50 entries below.
        </p>
      </header>

      {permissions.has("settings.manage") && <AdjustCashbackForm />}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {entries.length === 0 ? (
          <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">No cashback activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                <tr>
                  <th scope="col" className="px-5 py-3">When</th>
                  <th scope="col" className="px-5 py-3">Customer</th>
                  <th scope="col" className="px-5 py-3">Type</th>
                  <th scope="col" className="px-5 py-3">Note</th>
                  <th scope="col" className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-5 py-3">{formatWhen(entry.at)}</td>
                    <td className="px-5 py-3">{entry.customer}</td>
                    <td className="px-5 py-3">{LABEL[entry.source]}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-[#9FB3B7]">{entry.note ?? "—"}</td>
                    <td className={`px-5 py-3 text-right font-semibold tabular-nums ${entry.direction === "credit" ? "text-[#1E8E4F] dark:text-[#4CC38A]" : ""}`}>
                      {entry.direction === "credit" ? "+" : "−"}{formatNaira(entry.amount)}
                    </td>
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
