import type { Metadata } from "next";
import { connection } from "next/server";
import { CashbackManager } from "@/components/admin/cashback/manager";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { getCashbackSettings } from "@/lib/db/cashback";

export const metadata: Metadata = { title: "Cashback | Spur VTU" };

export default async function CashbackPage() {
  await connection();
  await requirePermission("products.view");
  const { permissions } = await getAdminAccess();
  const settings = await getCashbackSettings();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Cashback</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Customers earn cashback on successful purchases and can spend it at checkout. Keep rates below your margin.
        </p>
      </header>
      <CashbackManager settings={settings} canManage={permissions.has("products.manage")} />
    </div>
  );
}
