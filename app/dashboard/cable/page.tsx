import type { Metadata } from "next";
import { connection } from "next/server";
import { Tv } from "lucide-react";
import { requireSpursUser } from "@/lib/spurs";
import { CablePurchase } from "@/components/dashboard/cable-purchase";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import { getCableCatalog, hasCableVerifyProvider } from "@/lib/db/cable";
import { getCustomerPackage } from "@/lib/db/packages";
import { getNairaBalance } from "@/lib/wallet";
import { getCashbackBalance } from "@/lib/cashback";

export const metadata: Metadata = { title: "Cable TV | Spur VTU" };
export const instant = false;

export default async function BuyCablePage() {
  await connection();
  const user = await requireSpursUser();
  const customer = await getCustomerForPurchase(user.sub);
  const [operators, balance, pkg, cashback, canVerify] = await Promise.all([
    getCableCatalog(customer?.packageId ?? "basic"),
    getNairaBalance(user.sub),
    getCustomerPackage(user.sub),
    getCashbackBalance(user.sub),
    hasCableVerifyProvider(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Cable TV</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Choose an operator and bouquet, then enter the decoder number.
          {pkg && ` Prices shown are for your ${pkg.name} package.`}
        </p>
      </header>

      {customer?.status === "suspended" ? (
        <div role="status" className="max-w-2xl rounded-2xl border border-[#C8432B] bg-white p-5 text-[#12343B] dark:bg-white/5 dark:text-[#EEF3F4]">
          <p className="font-semibold">Your account is suspended</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Contact support to renew cable TV again.</p>
        </div>
      ) : operators.length === 0 ? (
        <div className="max-w-2xl rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <Tv className="mx-auto size-8 text-gray-400" aria-hidden="true" />
          <p className="mt-3 font-medium">Cable TV isn&apos;t available right now</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Please check back soon.</p>
        </div>
      ) : (
        <CablePurchase operators={operators} balance={balance} cashback={cashback} canVerify={canVerify} defaultPhone={customer?.phone ?? undefined} />
      )}
    </div>
  );
}
