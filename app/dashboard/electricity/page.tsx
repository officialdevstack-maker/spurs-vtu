import type { Metadata } from "next";
import { connection } from "next/server";
import { Zap } from "lucide-react";
import { requireSpursUser } from "@/lib/spurs";
import { ElectricityPurchase } from "@/components/dashboard/electricity-purchase";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import { getElectricityCatalog } from "@/lib/db/electricity";
import { getCustomerPackage } from "@/lib/db/packages";
import { getNairaBalance } from "@/lib/wallet";
import { getCashbackBalance } from "@/lib/cashback";

export const metadata: Metadata = { title: "Buy electricity | Spur VTU" };
export const instant = false;

export default async function BuyElectricityPage() {
  await connection();
  const user = await requireSpursUser();
  const customer = await getCustomerForPurchase(user.sub);
  const [discos, balance, pkg, cashback] = await Promise.all([
    getElectricityCatalog(customer?.packageId ?? "basic"),
    getNairaBalance(user.sub),
    getCustomerPackage(user.sub),
    getCashbackBalance(user.sub),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Buy electricity</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Choose your distribution company, enter your meter number and an amount.
          {pkg && ` Discounts shown are for your ${pkg.name} package.`}
        </p>
      </header>

      {customer?.status === "suspended" ? (
        <div role="status" className="max-w-2xl rounded-2xl border border-[#C8432B] bg-white p-5 text-[#12343B] dark:bg-white/5 dark:text-[#EEF3F4]">
          <p className="font-semibold">Your account is suspended</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Contact support to buy electricity again.</p>
        </div>
      ) : discos.length === 0 ? (
        <div className="max-w-2xl rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <Zap className="mx-auto size-8 text-gray-400" aria-hidden="true" />
          <p className="mt-3 font-medium">Electricity isn&apos;t available right now</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Please check back soon.</p>
        </div>
      ) : (
        <ElectricityPurchase discos={discos} balance={balance} cashback={cashback} defaultPhone={customer?.phone ?? undefined} />
      )}
    </div>
  );
}
