import type { Metadata } from "next";

export const metadata: Metadata = { title: "Customers | Spur VTU" };

export default function CustomersPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Customers</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Find, review and support customer accounts.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-gray-100 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="font-semibold">Customer management is coming soon</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Search customers, view wallet balances and transactions, and manage account status here.
        </p>
      </section>
    </div>
  );
}
