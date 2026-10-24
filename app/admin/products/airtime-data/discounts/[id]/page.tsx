import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { ArrowLeft } from "lucide-react";
import { DiscountForm } from "@/components/admin/airtime-data/discount-form";
import { discountsUrl } from "@/lib/admin/airtime-data";
import { getDiscount, getDiscountFormContext } from "@/lib/db/airtime-data";

export const metadata: Metadata = { title: "Edit airtime discount | Spur VTU" };

export default async function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requirePermission("products.view");
  const { id } = await params;

  const found = await getDiscount(id);
  if (!found) notFound();

  const context = await getDiscountFormContext(
    found.networkId,
    found.discount.type,
    found.discount.providerId ?? undefined,
  );
  if (!context) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link
          href={discountsUrl(context.network.id)}
          className="inline-flex items-center gap-2 rounded text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Airtime &amp; data
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Edit discount</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Change the {context.network.name} airtime discount.</p>
      </header>

      <DiscountForm
        network={context.network}
        types={context.types}
        providers={context.providers}
        discount={found.discount}
      />
    </div>
  );
}
