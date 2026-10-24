import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin overview | Spur VTU" };

export default function AdminOverviewPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Admin dashboard</p>
      </header>
    </div>
  );
}