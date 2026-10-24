import type { Metadata } from "next";
import { connection } from "next/server";
import { PackagesManager } from "@/components/admin/packages/manager";
import { requirePermission } from "@/lib/admin/auth";
import { listPackages } from "@/lib/db/packages";

export const metadata: Metadata = { title: "Packages | Spur VTU" };

export default async function PackagesPage() {
  await connection();
  await requirePermission("packages.manage");
  const packages = await listPackages();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Packages</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          What customers can upgrade to, and what it costs. Prices per package are set on each data plan.
        </p>
      </header>

      <PackagesManager packages={packages} />
    </div>
  );
}
