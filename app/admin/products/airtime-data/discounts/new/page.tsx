import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { DiscountForm } from "@/components/admin/airtime-data/discount-form";
import { discountsUrl } from "@/lib/admin/airtime-data";
import { getDiscountFormContext } from "@/lib/db/airtime-data";

export const metadata: Metadata = { title: "Add airtime discount | Spur VTU" };

export default async function NewDiscountPage({
  searchParams,
}: {
  searchParams: Promise<{ network?: string }>;
}) {
  await connection();
  const { network: networkId } = await searchParams;
  if (!networkId) notFound();

  const context = await getDiscountFormContext(networkId);
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
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Add discount</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Set the percentage off {context.network.name} airtime for an amount range.
        </p>
      </header>

      <DiscountForm network={context.network} types={context.types} providers={context.providers} />
    </div>
  );
}
