import type { Metadata } from "next";
import { connection } from "next/server";
import { Smartphone } from "lucide-react";
import { requireSpursUser } from "@spurs-cloud/accounts/next";
import { AirtimePurchase } from "@/components/dashboard/airtime-purchase";
import { getAirtimeCatalog } from "@/lib/db/airtime-purchase";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import { getNairaBalance } from "@/lib/wallet";

export const metadata: Metadata = { title: "Buy airtime | Spur VTU" };
export const instant = false;

export default async function BuyAirtimePage() {
  await connection();
  const user = await requireSpursUser();
  const [customer, networks, balance] = await Promise.all([
    getCustomerForPurchase(user.sub),
    getAirtimeCatalog(),
    getNairaBalance(user.sub),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Buy airtime</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Choose a network, enter an amount and the number to top up.
        </p>
      </header>

      {customer?.status === "suspended" ? (
        <div
          role="status"
          className="max-w-2xl rounded-2xl border border-[#C8432B] bg-white p-5 text-[#12343B] dark:bg-white/5 dark:text-[#EEF3F4]"
        >
          <p className="font-semibold">Your account is suspended</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Contact support to buy airtime again.</p>
        </div>
      ) : networks.length === 0 ? (
        <div className="max-w-2xl rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <Smartphone className="mx-auto size-8 text-gray-400" aria-hidden="true" />
          <p className="mt-3 font-medium">Airtime isn&apos;t available right now</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Please check back soon.</p>
        </div>
      ) : (
        <AirtimePurchase networks={networks} balance={balance} defaultPhone={customer?.phone ?? undefined} />
      )}
    </div>
  );
}
