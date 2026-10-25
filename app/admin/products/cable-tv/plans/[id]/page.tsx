import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { ArrowLeft } from "lucide-react";
import { PlanForm } from "@/components/admin/cable-tv/plan-form";
import { operatorUrl } from "@/lib/admin/cable";
import { getCablePlan, getCablePlanFormContext } from "@/lib/db/cable";

export const metadata: Metadata = { title: "Edit bouquet | Spur VTU" };
export const instant = false;

export default async function EditCablePlanPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requirePermission("products.view");
  const { id } = await params;
  const found = await getCablePlan(id);
  if (!found) notFound();

  const context = await getCablePlanFormContext(found.operatorId, found.plan.providerId ?? undefined);
  if (!context) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link
          href={operatorUrl(context.operator.id)}
          className="inline-flex items-center gap-2 rounded text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Cable TV
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Edit bouquet</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Change the {found.plan.name} bouquet on {context.operator.name}.</p>
      </header>

      <PlanForm operator={context.operator} providers={context.providers} packages={context.packages} plan={found.plan} />
    </div>
  );
}
