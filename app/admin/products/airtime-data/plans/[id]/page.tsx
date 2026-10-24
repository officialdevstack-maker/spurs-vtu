import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { ArrowLeft } from "lucide-react";
import { PlanForm } from "@/components/admin/airtime-data/plan-form";
import { plansUrl } from "@/lib/admin/airtime-data";
import { getPlan, getPlanFormContext } from "@/lib/db/airtime-data";

export const metadata: Metadata = { title: "Edit data plan | Spur VTU" };
export const instant = false;

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requirePermission("products.view");
  const { id } = await params;
  const found = await getPlan(id);
  if (!found) notFound();

  const context = await getPlanFormContext(found.networkId, found.plan.type, found.plan.providerId ?? undefined);
  if (!context) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link
          href={plansUrl(context.network.id)}
          className="inline-flex items-center gap-2 rounded text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Airtime &amp; data
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Edit data plan</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Change the {found.plan.size} plan on {context.network.name}.
        </p>
      </header>

      <PlanForm
        network={context.network}
        types={context.types}
        providers={context.providers}
        packages={context.packages}
        plan={found.plan}
      />
    </div>
  );
}
