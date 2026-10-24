import type { Metadata } from "next";

export const metadata: Metadata = { title: "Roles & permissions | Spur VTU" };

export default function RolesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
          Roles &amp; permissions
        </h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Control what each role can see and do in the admin area.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-gray-100 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="font-semibold">Roles and permissions are coming soon</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Create roles, choose their permissions and assign them to staff here.
        </p>
      </section>
    </div>
  );
}
