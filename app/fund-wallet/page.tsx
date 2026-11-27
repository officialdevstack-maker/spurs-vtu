import type { Metadata } from "next";
import { connection } from "next/server";
import { FundingPanel } from "@/components/funding/funding-panel";
import {
  getFlutterwaveAccount,
  getPaymentPointAccount,
  getRecentFundingIntents,
  getRecentPaymentPointFundingIntents,
} from "@/lib/db/wallet";
import {
  getPaymentPointProviderSettings,
  getPaymentProviderSettings,
} from "@/lib/db/payment-providers";
import { getNairaBalance } from "@/lib/wallet";
import { requireSpursUser } from "@/lib/spurs";

export const metadata: Metadata = { title: "Fund wallet | Spur VTU" };
export const instant = false;

export default async function FundWalletPage() {
  await connection();
  const user = await requireSpursUser();
  const [
    balance,
    permanentAccount,
    paymentPointAccount,
    pendingIntents,
    paymentPointPendingIntents,
    flutterwaveSettings,
    paymentPointSettings,
  ] = await Promise.all([
    getNairaBalance(user.sub),
    getFlutterwaveAccount(user.sub),
    getPaymentPointAccount(user.sub),
    getRecentFundingIntents(user.sub),
    getRecentPaymentPointFundingIntents(user.sub),
    getPaymentProviderSettings(),
    getPaymentPointProviderSettings(),
  ]);
  const accountView = permanentAccount
    ? {
        accountNumber: permanentAccount.accountNumber,
        bankName: permanentAccount.bankName,
        accountName: permanentAccount.accountName,
        status: permanentAccount.status,
      }
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Fund your wallet</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Choose a permanent account for repeat transfers or create a temporary account for one deposit.
        </p>
      </header>
      <FundingPanel
        balance={balance}
        permanentAccount={accountView}
        flutterwaveEnabled={flutterwaveSettings?.enabled ?? false}
        paymentPointAccount={paymentPointAccount}
        paymentPointEnabled={paymentPointSettings?.enabled ?? false}
        paymentPointMinimumKobo={paymentPointSettings?.minimumDepositKobo ?? 10_000}
        paymentPointPendingIntents={paymentPointPendingIntents}
        pendingIntents={pendingIntents}
        flutterwaveMinimumKobo={flutterwaveSettings?.minimumDepositKobo ?? 10_000}
      />
    </div>
  );
}
