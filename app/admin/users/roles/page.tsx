import type { Metadata } from "next";
import { connection } from "next/server";
import { RolesManager } from "@/components/admin/roles/manager";
import { requirePermission } from "@/lib/admin/auth";
import { listRoles, listStaff } from "@/lib/db/roles";

export const metadata: Metadata = { title: "Roles & permissions | Spur VTU" };

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await connection();
  await requirePermission("roles.manage");
  const { tab } = await searchParams;
  const [roles, staff] = await Promise.all([listRoles(), listStaff()]);

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
      <RolesManager roles={roles} staff={staff} initialTab={tab === "staff" ? "staff" : "roles"} />
    </div>
  );
}
