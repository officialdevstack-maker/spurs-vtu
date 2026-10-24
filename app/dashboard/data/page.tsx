import type { Metadata } from "next";
import { connection } from "next/server";
import { Wifi } from "lucide-react";
import { requireSpursUser } from "@spurs-cloud/accounts/next";
import { DataPurchase } from "@/components/dashboard/data-purchase";
import { getCustomerForPurchase, getDataCatalog } from "@/lib/db/data-purchase";
import { getCustomerPackage } from "@/lib/db/packages";
import { getNairaBalance } from "@/lib/wallet";

export const metadata: Metadata = { title: "Buy data | Spur VTU" };
export const instant = false;

export default async function BuyDataPage() {
  await connection();
  const user = await requireSpursUser();
  const customer = await getCustomerForPurchase(user.sub);
  const [networks, balance, pkg] = await Promise.all([
    getDataCatalog(customer?.packageId ?? "basic"),
    getNairaBalance(user.sub),
    getCustomerPackage(user.sub),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Buy data</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Choose a network and plan.{pkg && ` Prices shown are for your ${pkg.name} package.`}
        </p>
      </header>

      {customer?.status === "suspended" ? (
        <div
          role="status"
          className="max-w-2xl rounded-2xl border border-[#C8432B] bg-white p-5 text-[#12343B] dark:bg-white/5 dark:text-[#EEF3F4]"
        >
          <p className="font-semibold">Your account is suspended</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Contact support to buy data again.</p>
        </div>
      ) : networks.length === 0 ? (
        <div className="max-w-2xl rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <Wifi className="mx-auto size-8 text-gray-400" aria-hidden="true" />
          <p className="mt-3 font-medium">No data plans right now</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Please check back soon.</p>
        </div>
      ) : (
        <DataPurchase networks={networks} balance={balance} defaultPhone={customer?.phone ?? undefined} />
      )}
    </div>
  );
}
