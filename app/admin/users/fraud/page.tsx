import type { Metadata } from "next";
import { connection } from "next/server";
import { FraudManager } from "@/components/admin/fraud/manager";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { getRules, listOpenFlags } from "@/lib/db/fraud";

export const metadata: Metadata = { title: "Fraud review | Spur VTU" };

export default async function FraudPage() {
  await connection();
  await requirePermission("customers.view");
  const { permissions } = await getAdminAccess();
  const [rules, flags] = await Promise.all([getRules(), listOpenFlags()]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Fraud review</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Configure purchase checks and review unusual activity.
        </p>
      </header>
      <FraudManager
        rules={rules}
        flags={flags}
        canManageRules={permissions.has("settings.manage")}
        canManageCustomers={permissions.has("customers.manage")}
      />
    </div>
  );
}
