import type { Metadata } from "next";
import { connection } from "next/server";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { listPromos } from "@/lib/db/promotions";
import { PromotionsManager } from "./manager";

export const metadata: Metadata = { title: "Promotions | Spur VTU" };

export default async function PromotionsPage() {
  await connection();
  await requirePermission("products.view");
  const { permissions } = await getAdminAccess();
  const promos = await listPromos();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Promotions</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Promo codes take money off purchases. One code per purchase, and cashback still applies to the discounted price.
        </p>
      </header>
      <PromotionsManager promos={promos} canManage={permissions.has("products.manage")} />
    </div>
  );
}
