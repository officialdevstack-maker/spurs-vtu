import type { Metadata } from "next";
import { connection } from "next/server";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import { getProfileSettings } from "@/lib/db/profile";
import { getFlutterwaveAccount } from "@/lib/db/wallet";
import { requireSpursUser } from "@/lib/spurs";
import { PinSettings } from "@/components/dashboard/pin-settings";
import { getPinState } from "@/lib/db/pin";

export const metadata: Metadata = { title: "Profile | Spur VTU" };
export const instant = false;

export default async function ProfilePage() {
  await connection();
  const user = await requireSpursUser();
  const [customer, settings, account, pinState] = await Promise.all([
    getCustomerForPurchase(user.sub),
    getProfileSettings(user.sub),
    getFlutterwaveAccount(user.sub),
    getPinState(user.sub),
  ]);
  const username = "username" in user && typeof user.username === "string" ? user.username : null;
  const verified = "kyc_status" in user ? user.kyc_status === "verified" : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Your details and how Spur VTU behaves for you.</p>
      </header>
      <ProfileForm
        name={user.name ?? ""}
        username={username}
        email={user.email ?? ""}
        phone={customer?.phone ?? ""}
        verified={verified}
        account={
          account?.status === "active" && account.accountNumber
            ? { bankName: account.bankName ?? "", accountNumber: account.accountNumber }
            : null
        }
        settings={settings}
      />
      <PinSettings hasPin={pinState.hasPin} />
    </div>
  );
}
