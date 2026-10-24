import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transaction calculator | Spur VTU" };

export default function TransactionCalculatorPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Calculator</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Calculate transaction amounts and margins.</p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-gray-100 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="font-semibold">Transaction calculator is coming soon</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Transaction calculation tools will be available here.
        </p>
      </section>
    </div>
  );
}
