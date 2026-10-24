import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { ArrowLeft } from "lucide-react";
import { PlanForm } from "@/components/admin/airtime-data/plan-form";
import { plansUrl } from "@/lib/admin/airtime-data";
import { getPlanFormContext } from "@/lib/db/airtime-data";

export const metadata: Metadata = { title: "Add data plan | Spur VTU" };

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ network?: string; type?: string }>;
}) {
  await connection();
  await requirePermission("products.view");
  const { network: networkId, type } = await searchParams;
  if (!networkId) notFound();

  const context = await getPlanFormContext(networkId);
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
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Add data plan</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Create a data plan for {context.network.name}.</p>
      </header>

      <PlanForm network={context.network} types={context.types} providers={context.providers} defaultType={type} />
    </div>
  );
}
