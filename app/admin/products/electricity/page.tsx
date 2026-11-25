import type { Metadata } from "next";
import { connection } from "next/server";
import { ElectricityManager } from "@/components/admin/electricity/manager";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { getDiscos, listElectricityProviders } from "@/lib/db/electricity";

export const metadata: Metadata = { title: "Electricity | Spur VTU" };

export default async function ElectricityPage() {
  await connection();
  await requirePermission("products.view");
  const { permissions } = await getAdminAccess();
  const [discos, providers] = await Promise.all([getDiscos(), listElectricityProviders()]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Electricity</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Manage distribution companies, customer discounts, purchase limits and which provider fulfils each one.
        </p>
      </header>
      <ElectricityManager discos={discos} providers={providers} canManage={permissions.has("products.manage")} />
    </div>
  );
}
