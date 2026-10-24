import type { Metadata } from "next";
import { connection } from "next/server";
import { AirtimeDataManager } from "@/components/admin/airtime-data/manager";
import { getAirtimeDataProducts } from "@/lib/db/airtime-data";

export const metadata: Metadata = { title: "Airtime & data | Spur VTU" };

export default async function AirtimeDataPage({
  searchParams,
}: {
  searchParams: Promise<{ network?: string; tab?: string }>;
}) {
  await connection();
  const { network, tab } = await searchParams;
  const { networks, types } = await getAirtimeDataProducts();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Airtime &amp; data</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Manage networks, network types, airtime discounts, data plans and pin stock.
        </p>
      </header>

      <AirtimeDataManager networks={networks} types={types} initialNetwork={network} initialSection={tab} />
    </div>
  );
}
