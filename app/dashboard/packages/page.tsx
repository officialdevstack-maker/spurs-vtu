import type { Metadata } from "next";
import { connection } from "next/server";
import { Check } from "lucide-react";
import { UpgradeButton } from "@/components/dashboard/upgrade-button";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import { getCustomerPackage, listPackages } from "@/lib/db/packages";
import { formatNaira } from "@/lib/format";
import { requireSpursUser } from "@/lib/spurs";
import { getNairaBalance } from "@/lib/wallet";
import { getPinState } from "@/lib/db/pin";

export const metadata: Metadata = { title: "Packages | Spur VTU" };
export const instant = false;

export default async function PackagesPage() {
  await connection();
  const user = await requireSpursUser();
  const [packages, current, balance, customer, pinState] = await Promise.all([
    listPackages(),
    getCustomerPackage(user.sub),
    getNairaBalance(user.sub),
    getCustomerForPurchase(user.sub),
    getPinState(user.sub),
  ]);
  const suspended = customer?.status === "suspended";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Packages</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Upgrade for lower rates on every service.
          {balance !== null && <> Your wallet balance is {formatNaira(balance)}.</>}
        </p>
      </header>

      {suspended && (
        <div
          role="status"
          className="rounded-2xl border border-[#C8432B] bg-white p-5 text-[#12343B] dark:bg-white/5 dark:text-[#EEF3F4]"
        >
          <p className="font-semibold">Your account is suspended</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Contact support to upgrade your package.</p>
        </div>
      )}

      {packages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <p className="font-medium">No packages available right now</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Please check back soon.</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => {
            const isCurrent = pkg.id === current?.id;
            const canUpgrade = !suspended && !!current && pkg.sortOrder > current.sortOrder;
            return (
              <li
                key={pkg.id}
                className={`flex flex-col rounded-2xl border p-6 ${
                  isCurrent
                    ? "border-[#12343B] bg-white ring-1 ring-[#12343B] dark:border-[#F2B632] dark:bg-white/5 dark:ring-[#F2B632]"
                    : "border-gray-200 bg-white dark:border-white/10 dark:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">{pkg.name}</h2>
                  {isCurrent && (
                    <span className="rounded-md bg-[#F2B632] px-2 py-0.5 text-xs font-semibold text-[#12343B]">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-2 flex-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
                  {pkg.description || "Package rates apply to every purchase."}
                </p>
                <p className="mt-4 flex items-center gap-2 text-sm">
                  <Check className="size-4 text-[#1E8E4F] dark:text-[#4CC38A]" aria-hidden="true" />
                  {pkg.upgradeFee > 0 ? `One-time upgrade fee: ${formatNaira(pkg.upgradeFee)}` : "No upgrade fee"}
                </p>
                <div className="mt-5">
                  {canUpgrade ? (
                    <UpgradeButton packageId={pkg.id} name={pkg.name} fee={pkg.upgradeFee} pinRequired={pinState.hasPin} />
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
                      {isCurrent ? "You're on this package." : "Not available to switch to."}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
