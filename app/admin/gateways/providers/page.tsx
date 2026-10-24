import type { Metadata } from "next";

export const metadata: Metadata = { title: "Providers | Spur VTU" };

export default function ProvidersPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Providers</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Manage service provider integrations.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-gray-100 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="font-semibold">Provider settings are coming soon</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Provider configuration and status controls will be available here.
        </p>
      </section>
    </div>
  );
}
