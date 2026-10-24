import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { RoleForm } from "@/components/admin/roles/role-form";
import { requirePermission } from "@/lib/admin/auth";
import { rolesUrl } from "@/lib/admin/roles";

export const metadata: Metadata = { title: "Add role | Spur VTU" };

export default async function NewRolePage() {
  await connection();
  await requirePermission("roles.manage");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link
          href={rolesUrl("roles")}
          className="inline-flex items-center gap-2 rounded text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Roles &amp; permissions
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Add role</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Name the role and choose what it can do.</p>
      </header>
      <RoleForm />
    </div>
  );
}
