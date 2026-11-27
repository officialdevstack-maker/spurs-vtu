"use client";

import { useState, useTransition } from "react";
import {
  createPaymentPointTemporaryFundingAccount,
  createPaymentPointFundingAccount,
  createPermanentFundingAccount,
  createTemporaryFundingAccount,
  type FundingAccountResult,
} from "@/app/fund-wallet/actions";
import type { FundingIntent, PaymentPointAccount } from "@/lib/db/wallet";
import { formatNaira } from "@/lib/format";

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B] dark:focus-visible:ring-[#F2B632]";

type PermanentAccountView = {
  accountNumber: string | null;
  bankName: string | null;
  accountName: string | null;
  status: "creating" | "active";
};

function AccountDetails({ account }: { account: FundingAccountResult }) {
  return (
    <dl className="mt-4 grid gap-3 rounded-xl bg-[#E6F4EC] p-4 text-sm dark:bg-[#4CC38A]/10 sm:grid-cols-3">
      <div>
        <dt className="text-gray-600 dark:text-[#9FB3B7]">Bank</dt>
        <dd className="mt-1 font-semibold">{account.bankName}</dd>
      </div>
      <div>
        <dt className="text-gray-600 dark:text-[#9FB3B7]">Account number</dt>
        <dd className="mt-1 font-semibold tabular-nums">{account.accountNumber}</dd>
      </div>
      <div>
        <dt className="text-gray-600 dark:text-[#9FB3B7]">Account name</dt>
        <dd className="mt-1 font-semibold">{account.accountName || "Your name"}</dd>
      </div>
    </dl>
  );
}

export function FundingPanel({
  balance,
  permanentAccount,
  flutterwaveEnabled,
  paymentPointAccount,
  paymentPointEnabled,
  paymentPointPendingIntents,
  pendingIntents,
}: {
  balance: number | null;
  permanentAccount: PermanentAccountView | null;
  flutterwaveEnabled: boolean;
  paymentPointAccount: PaymentPointAccount | null;
  paymentPointEnabled: boolean;
  paymentPointPendingIntents: FundingIntent[];
  pendingIntents: FundingIntent[];
}) {
  const [bvn, setBvn] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentPointAmount, setPaymentPointAmount] = useState("");
  const [permanentAccountResult, setPermanentAccountResult] = useState<FundingAccountResult | null>(null);
  const [paymentPointAccountResult, setPaymentPointAccountResult] = useState<FundingAccountResult | null>(null);
  const [paymentPointTemporaryResult, setPaymentPointTemporaryResult] = useState<
    (FundingAccountResult & { amount: number; reference: string }) | null
  >(null);
  const [temporaryAccountResult, setTemporaryAccountResult] = useState<
    (FundingAccountResult & { amount: number; reference: string }) | null
  >(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function createPermanent() {
    setError("");
    setPermanentAccountResult(null);
    startTransition(async () => {
      try {
        const result = await createPermanentFundingAccount(bvn);
        if (result.ok) {
          setPermanentAccountResult(result.value);
          setBvn("");
        } else {
          setError(result.error);
        }
      } catch {
        setError("We couldn't create your account. Please try again.");
      }
    });
  }

  function createTemporary() {
    setError("");
    setTemporaryAccountResult(null);
    startTransition(async () => {
      try {
        const result = await createTemporaryFundingAccount(amount);
        if (result.ok) {
          setTemporaryAccountResult(result.value);
          setAmount("");
        } else {
          setError(result.error);
        }
      } catch {
        setError("We couldn't create a temporary account. Please try again.");
      }
    });
  }

  function createPaymentPoint() {
    setError("");
    setPaymentPointAccountResult(null);
    startTransition(async () => {
      try {
        const result = await createPaymentPointFundingAccount();
        if (result.ok) {
          setPaymentPointAccountResult(result.value);
        } else {
          setError(result.error);
        }
      } catch {
        setError("We couldn't create your account. Please try again.");
      }
    });
  }

  function createPaymentPointTemporary() {
    setError("");
    setPaymentPointTemporaryResult(null);
    startTransition(async () => {
      try {
        const result = await createPaymentPointTemporaryFundingAccount(paymentPointAmount);
        if (result.ok) {
          setPaymentPointTemporaryResult(result.value);
          setPaymentPointAmount("");
        } else {
          setError(result.error);
        }
      } catch {
        setError("We couldn't create a one-time account. Please try again.");
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-2xl bg-[#12343B] p-6 text-[#EEF3F4]">
        <p className="text-sm text-[#B9C8CB]">VTU wallet balance</p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tabular-nums">
          {balance === null ? "Unavailable" : formatNaira(balance)}
        </p>
        <p className="mt-2 text-sm text-[#B9C8CB]">Deposits are credited to your VTU wallet after your payment is confirmed.</p>
      </section>

      {(paymentPointEnabled || paymentPointAccount) && (
        <section className="rounded-2xl border border-gray-200 p-5 dark:border-white/10 sm:p-6">
          <h2 className="font-semibold">Repeat-transfer account</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
            Use this account for repeat bank transfers. Payments are added to your VTU wallet after they are confirmed.
          </p>
          {paymentPointAccount?.status === "active" && paymentPointAccount.accountNumber ? (
            <AccountDetails
              account={{
                accountNumber: paymentPointAccount.accountNumber,
                bankName: paymentPointAccount.bankName ?? "Bank",
                accountName: paymentPointAccount.accountName ?? "",
              }}
            />
          ) : paymentPointAccount?.status === "creating" ? (
            <p role="status" className="mt-4 text-sm text-gray-600 dark:text-[#9FB3B7]">
              Account setup is in progress. Refresh shortly; if it does not appear, you can retry.
            </p>
          ) : paymentPointEnabled ? (
            <button
              type="button"
              onClick={createPaymentPoint}
              disabled={pending}
              className="mt-4 h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] outline-none hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Creating account…" : "Create repeat-transfer account"}
            </button>
          ) : (
            <p role="status" className="mt-4 text-sm text-gray-600 dark:text-[#9FB3B7]">
              New account creation is temporarily unavailable. Your existing account remains active for payments.
            </p>
          )}
          {paymentPointAccountResult && <AccountDetails account={paymentPointAccountResult} />}
          {!paymentPointEnabled && paymentPointAccount?.status === "active" && (
            <p role="status" className="mt-3 text-xs text-gray-600 dark:text-[#9FB3B7]">
              New account creation is temporarily unavailable. Your existing account remains active for payments.
            </p>
          )}
        </section>
      )}

      <section
        hidden={!paymentPointEnabled && paymentPointPendingIntents.length === 0}
        className="rounded-2xl border border-gray-200 p-5 dark:border-white/10 sm:p-6"
      >
        <h2 className="font-semibold">One-time transfer account</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Create an account for one deposit. Transfer exactly the amount shown while the account is active.
        </p>
        {paymentPointEnabled ? (
          <>
            <label htmlFor="paymentpoint-funding-amount" className="mt-4 block text-sm font-medium">
              Amount (₦)
            </label>
            <input
              id="paymentpoint-funding-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="5000"
              value={paymentPointAmount}
              onChange={(event) => setPaymentPointAmount(event.target.value.replace(/[^\d.]/g, "").slice(0, 10))}
              className={fieldClass}
            />
            <button
              type="button"
              onClick={createPaymentPointTemporary}
              disabled={pending || !paymentPointAmount}
              className="mt-4 h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] outline-none hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Creating account…" : "Create one-time account"}
            </button>
          </>
        ) : (
          <p role="status" className="mt-4 text-sm text-gray-600 dark:text-[#9FB3B7]">
            New account creation is temporarily unavailable. Existing accounts remain active for payments.
          </p>
        )}

        {paymentPointTemporaryResult && (
          <div className="mt-4 rounded-xl border border-[#F2B632]/60 bg-[#FFF8E1] p-4 dark:bg-[#F2B632]/10">
            <p className="font-semibold">
              Transfer exactly {formatNaira(paymentPointTemporaryResult.amount)}
            </p>
            <AccountDetails account={paymentPointTemporaryResult} />
            <p className="mt-3 text-xs text-gray-600 dark:text-[#9FB3B7]">
              Reference: <span className="font-mono">{paymentPointTemporaryResult.reference}</span>
            </p>
          </div>
        )}

        {paymentPointPendingIntents.length > 0 && (
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold">Recent one-time accounts</h3>
            {paymentPointPendingIntents.map((intent) => (
              <div key={intent.reference} className="rounded-xl bg-gray-100 p-4 text-sm dark:bg-white/5">
                <p className="font-semibold">
                  Transfer {formatNaira(intent.amountKobo / 100)}
                  {intent.status === "creating" ? " · Preparing account" : ""}
                </p>
                {intent.accountNumber && (
                  <p className="mt-1">
                    {intent.bankName} · <span className="font-semibold tabular-nums">{intent.accountNumber}</span>
                  </p>
                )}
                <p className="mt-1 break-all font-mono text-xs text-gray-600 dark:text-[#9FB3B7]">
                  {intent.reference}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        hidden={!flutterwaveEnabled && !permanentAccount}
        className="rounded-2xl border border-gray-200 p-5 dark:border-white/10 sm:p-6"
      >
        <h2 className="font-semibold">Permanent account</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Use this account number for future bank transfers. Your BVN is securely sent to our payment provider for account
          verification and is not saved by VTU.
        </p>
        {permanentAccount?.status === "active" && permanentAccount.accountNumber ? (
          <AccountDetails
            account={{
              accountNumber: permanentAccount.accountNumber,
              bankName: permanentAccount.bankName ?? "Bank",
              accountName: permanentAccount.accountName ?? "",
            }}
          />
        ) : permanentAccount?.status === "creating" ? (
          <p role="status" className="mt-4 text-sm text-gray-600 dark:text-[#9FB3B7]">
            Account setup is in progress. Refresh this page shortly.
          </p>
        ) : flutterwaveEnabled ? (
          <div className="mt-4">
            <label htmlFor="funding-bvn" className="text-sm font-medium">
              Your BVN
            </label>
            <input
              id="funding-bvn"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              value={bvn}
              onChange={(event) => setBvn(event.target.value.replace(/\D/g, "").slice(0, 11))}
              className={fieldClass}
              aria-describedby="funding-bvn-note"
            />
            <p id="funding-bvn-note" className="mt-2 text-xs text-gray-600 dark:text-[#9FB3B7]">
              Enter the BVN associated with your own name. Do not enter another person&apos;s BVN.
            </p>
            <button
              type="button"
              onClick={createPermanent}
              disabled={pending || bvn.length !== 11}
              className="mt-4 h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] outline-none hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Creating account…" : "Create permanent account"}
            </button>
          </div>
        ) : (
          <p role="status" className="mt-4 text-sm text-gray-600 dark:text-[#9FB3B7]">
            New account creation is temporarily unavailable. Your existing account remains active for payments.
          </p>
        )}
        {permanentAccountResult && <AccountDetails account={permanentAccountResult} />}
      </section>

      <section
        hidden={!flutterwaveEnabled && pendingIntents.length === 0}
        className="rounded-2xl border border-gray-200 p-5 dark:border-white/10 sm:p-6"
      >
        <h2 className="font-semibold">Temporary account</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Create a bank account for a specific deposit. Transfer the exact amount shown while the account is active.
        </p>
        {flutterwaveEnabled ? (
          <>
            <label htmlFor="funding-amount" className="mt-4 block text-sm font-medium">
              Amount (₦)
            </label>
            <input
              id="funding-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="5000"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, "").slice(0, 10))}
              className={fieldClass}
            />
            <button
              type="button"
              onClick={createTemporary}
              disabled={pending || !amount}
              className="mt-4 h-11 rounded-xl border border-[#12343B] px-5 text-sm font-semibold text-[#12343B] outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#F2B632] dark:text-[#F2B632] dark:hover:bg-white/5 dark:focus-visible:ring-[#F2B632]"
            >
              {pending ? "Creating account…" : "Create temporary account"}
            </button>
          </>
        ) : (
          <p role="status" className="mt-4 text-sm text-gray-600 dark:text-[#9FB3B7]">
            New account creation is temporarily unavailable. Your existing accounts remain active for payments.
          </p>
        )}

        {temporaryAccountResult && (
          <div className="mt-4 rounded-xl border border-[#F2B632]/60 bg-[#FFF8E1] p-4 dark:bg-[#F2B632]/10">
            <p className="font-semibold">Transfer exactly {formatNaira(temporaryAccountResult.amount)}</p>
            <AccountDetails account={temporaryAccountResult} />
            <p className="mt-3 text-xs text-gray-600 dark:text-[#9FB3B7]">
              Reference: <span className="font-mono">{temporaryAccountResult.reference}</span>
            </p>
          </div>
        )}

        {pendingIntents.length > 0 && (
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold">Recent temporary accounts</h3>
            {pendingIntents.map((intent) => (
              <div key={intent.reference} className="rounded-xl bg-gray-100 p-4 text-sm dark:bg-white/5">
                <p className="font-semibold">
                  Transfer {formatNaira(intent.amountKobo / 100)}
                  {intent.status === "creating" ? " · Preparing account" : ""}
                </p>
                {intent.accountNumber && (
                  <p className="mt-1">
                    {intent.bankName} · <span className="font-semibold tabular-nums">{intent.accountNumber}</span>
                  </p>
                )}
                {intent.expiresAt && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">
                    Expires {new Date(intent.expiresAt).toLocaleString()}
                  </p>
                )}
                <p className="mt-1 break-all font-mono text-xs text-gray-600 dark:text-[#9FB3B7]">{intent.reference}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-[#C8432B] px-4 py-3 text-sm text-[#C8432B]">
          {error}
        </p>
      )}
    </div>
  );
}
