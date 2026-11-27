"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { accountDetails, getFlutterwave } from "@/lib/flutterwave";
import {
  deleteCreatingPaymentPointAccount,
  createFundingIntent,
  createPaymentPointFundingIntent,
  failPaymentPointFundingIntent,
  getFlutterwaveAccount,
  reserveFlutterwaveAccount,
  reservePaymentPointAccount,
  saveFlutterwaveAccount,
  savePaymentPointAccount,
  savePaymentPointFundingIntentAccount,
  saveFundingIntentAccount,
} from "@/lib/db/wallet";
import { getPool } from "@/lib/db";
import {
  createPaymentPointAccount,
  createPaymentPointTemporaryAccount,
  PaymentPointApiError,
} from "@/lib/paymentpoint";
import { getPaymentPointProviderSettings, getPaymentProviderSettings } from "@/lib/db/payment-providers";
import { requireSpursUser } from "@/lib/spurs";

export type FundingActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type FundingAccountResult = {
  accountNumber: string;
  bankName: string;
  accountName: string;
};

function customerName(user: { name?: string | null; username?: string | null }) {
  const name = user.name?.trim() || user.username?.trim() || "Spurs customer";
  return name.slice(0, 100);
}

function logPaymentPointError(context: string, error: unknown): void {
  if (error instanceof PaymentPointApiError) {
    console.error(context, { status: error.status, providerMessage: error.providerMessage });
  } else {
    console.error(
      context,
      error instanceof Error ? { name: error.name, message: error.message } : "Unknown error",
    );
  }
}

function publicAccount(account: {
  accountNumber: string | null;
  bankName: string | null;
  accountName: string | null;
}): FundingActionResult<FundingAccountResult> {
  if (!account.accountNumber || !account.bankName) {
    return { ok: false, error: "We couldn't retrieve usable account details. Please try again." };
  }
  return {
    ok: true,
    value: {
      accountNumber: account.accountNumber,
      bankName: account.bankName,
      accountName: account.accountName ?? "",
    },
  };
}

export async function createPermanentFundingAccount(bvn: string): Promise<FundingActionResult<FundingAccountResult>> {
  const user = await requireSpursUser();
  if (!/^\d{11}$/.test(bvn)) {
    return { ok: false, error: "Enter the 11-digit BVN belonging to your account." };
  }
  if (!user.email || (!user.name && !user.username)) {
    return { ok: false, error: "Add your name and email to your Spurs account before creating a permanent account." };
  }

  const existing = await getFlutterwaveAccount(user.sub);
  if (existing?.status === "active") return publicAccount(existing);

  let flutterwave: Awaited<ReturnType<typeof getFlutterwave>>;
  try {
    flutterwave = await getFlutterwave();
  } catch (error) {
    console.error("[funding] Payment provider is not configured", error instanceof Error ? error.name : "Unknown error");
    return { ok: false, error: "Funding is not available right now." };
  }

  try {
    const txRef = existing?.txRef ?? randomUUID();
    const reserved = await reserveFlutterwaveAccount(user.sub, txRef);
    if (reserved.status === "active") return publicAccount(reserved);
    const name = customerName(user);
    const response = await flutterwave.VirtualAcct.create({
      email: user.email,
      is_permanent: true,
      bvn,
      tx_ref: reserved.txRef,
      narration: name,
    });
    const details = accountDetails(response);
    const account = await saveFlutterwaveAccount({
      customerId: user.sub,
      txRef: reserved.txRef,
      accountNumber: details.accountNumber,
      bankName: details.bankName,
      accountName: details.accountName || name,
    });
    revalidatePath("/fund-wallet");
    revalidatePath("/dashboard");
    return publicAccount(account);
  } catch (error) {
    console.error("[funding] Permanent account setup failed", error instanceof Error ? error.name : "Unknown error");
    return {
      ok: false,
      error: "We couldn't create your permanent account. Check your details and try again.",
    };
  }
}

export async function createPaymentPointFundingAccount(): Promise<FundingActionResult<FundingAccountResult>> {
  const user = await requireSpursUser();
  if (!user.email || (!user.name && !user.username)) {
    return { ok: false, error: "Add your name and email to your Spurs account before creating an account." };
  }
  const { rows } = await getPool().query<{ phone: string | null }>(
    "select phone from customers where id = $1",
    [user.sub],
  );
  const phoneNumber = rows[0]?.phone?.trim();
  if (!phoneNumber) {
    return { ok: false, error: "Add a phone number to your Spurs account before creating a PaymentPoint account." };
  }

  const reservation = await reservePaymentPointAccount(user.sub);
  if (!reservation.created) {
    if (
      reservation.account.status === "active" &&
      reservation.account.accountNumber &&
      reservation.account.bankName
    ) {
      return publicAccount(reservation.account);
    }
    return { ok: false, error: "Your PaymentPoint account is already being created. Refresh the page shortly." };
  }

  const name = customerName(user);
  let details: Awaited<ReturnType<typeof createPaymentPointAccount>>;
  try {
    details = await createPaymentPointAccount({ email: user.email, name, phoneNumber });
  } catch (error) {
    const requestRejected =
      error instanceof PaymentPointApiError && error.status >= 400 && error.status < 500;
    await deleteCreatingPaymentPointAccount(user.sub);
    logPaymentPointError("[funding] PaymentPoint account setup failed", error);
    return {
      ok: false,
      error: requestRejected
        ? "PaymentPoint rejected the account request. Check your profile details and try again."
        : "PaymentPoint did not return usable account details. Check the server log and try again.",
    };
  }

  try {
    const account = await savePaymentPointAccount({
      customerId: user.sub,
      accountNumber: details.accountNumber,
      bankName: details.bankName,
      accountName: details.accountName || name,
      reservedAccountId: details.reservedAccountId,
    });
    revalidatePath("/fund-wallet");
    revalidatePath("/dashboard");
    return publicAccount(account);
  } catch (error) {
    console.error("[funding] PaymentPoint account was created but could not be saved", error instanceof Error ? error.name : "Unknown error");
    return {
      ok: false,
      error: "PaymentPoint created your account, but we couldn't save its details. Contact support before trying again.",
    };
  }
}

export async function createPaymentPointTemporaryFundingAccount(
  amountInput: string,
): Promise<FundingActionResult<FundingAccountResult & { amount: number; reference: string }>> {
  const user = await requireSpursUser();
  const providerSettings = await getPaymentPointProviderSettings();
  const minimumDepositKobo = providerSettings?.minimumDepositKobo ?? 10_000;
  const minimumAmount = minimumDepositKobo / 100;
  const amount = Number(amountInput);
  const amountKobo = Math.round(amount * 100);
  if (
    !/^\d{1,7}(?:\.\d{1,2})?$/.test(amountInput) ||
    !Number.isFinite(amount) ||
    !Number.isSafeInteger(amountKobo) ||
    amountKobo < minimumDepositKobo ||
    amountKobo > 100_000_000
  ) {
    return { ok: false, error: `Enter a funding amount from ₦${minimumAmount.toFixed(2)} to ₦1,000,000.` };
  }
  if (!user.email || (!user.name && !user.username)) {
    return { ok: false, error: "Add your name and email to your Spurs account before creating an account." };
  }

  const { rows } = await getPool().query<{ phone: string | null }>(
    "select phone from customers where id = $1",
    [user.sub],
  );
  const phoneNumber = rows[0]?.phone?.trim();
  if (!phoneNumber) {
    return { ok: false, error: "Add a phone number to your Spurs account before creating a PaymentPoint account." };
  }

  const reference = randomUUID();
  const intent = await createPaymentPointFundingIntent({
    reference,
    customerId: user.sub,
    amountKobo,
  });
  const name = customerName(user);
  let details: Awaited<ReturnType<typeof createPaymentPointTemporaryAccount>>;
  try {
    details = await createPaymentPointTemporaryAccount({
      email: user.email,
      name,
      phoneNumber,
      amount: amountKobo / 100,
    });
  } catch (error) {
    await failPaymentPointFundingIntent(intent.reference, user.sub);
    logPaymentPointError("[funding] PaymentPoint temporary account setup failed", error);
    return {
      ok: false,
      error: "PaymentPoint did not return usable account details. Check the server log and try again.",
    };
  }

  try {
    const saved = await savePaymentPointFundingIntentAccount({
      reference: intent.reference,
      customerId: user.sub,
      accountNumber: details.accountNumber,
      bankName: details.bankName,
    });
    revalidatePath("/fund-wallet");
    revalidatePath("/dashboard");
    return {
      ok: true,
      value: {
        accountNumber: saved.accountNumber ?? details.accountNumber,
        bankName: saved.bankName ?? details.bankName,
        accountName: details.accountName || name,
        amount: saved.amountKobo / 100,
        reference: saved.reference,
      },
    };
  } catch (error) {
    console.error(
      "[funding] PaymentPoint temporary account was created but could not be saved",
      error instanceof Error ? { name: error.name, message: error.message } : "Unknown error",
    );
    return {
      ok: false,
      error: "PaymentPoint created the temporary account, but we couldn't save its details. Try again.",
    };
  }
}

export async function createTemporaryFundingAccount(
  amountInput: string,
): Promise<FundingActionResult<FundingAccountResult & { amount: number; reference: string }>> {
  const user = await requireSpursUser();
  const providerSettings = await getPaymentProviderSettings();
  const minimumDepositKobo = providerSettings?.minimumDepositKobo ?? 10_000;
  const minimumAmount = minimumDepositKobo / 100;
  const amount = Number(amountInput);
  const amountKobo = Math.round(amount * 100);
  if (
    !/^\d{1,7}(?:\.\d{1,2})?$/.test(amountInput) ||
    !Number.isFinite(amount) ||
    !Number.isSafeInteger(amountKobo) ||
    amountKobo < minimumDepositKobo ||
    amountKobo > 100_000_000
  ) {
    return { ok: false, error: `Enter a funding amount from ₦${minimumAmount.toFixed(2)} to ₦1,000,000.` };
  }
  if (!user.email) return { ok: false, error: "Add an email address to your Spurs account first." };

  let flutterwave: Awaited<ReturnType<typeof getFlutterwave>>;
  try {
    flutterwave = await getFlutterwave();
  } catch (error) {
    console.error("[funding] Payment provider is not configured", error instanceof Error ? error.name : "Unknown error");
    return { ok: false, error: "Funding is not available right now." };
  }
  const reference = randomUUID();
  const intent = await createFundingIntent({ reference, customerId: user.sub, amountKobo });

  try {
    const name = customerName(user);
    const response = await flutterwave.VirtualAcct.create({
      email: user.email,
      is_permanent: false,
      amount: amountKobo / 100,
      tx_ref: reference,
      narration: name,
    });
    const details = accountDetails(response);
    const fundingIntent = await saveFundingIntentAccount({
      reference: intent.reference,
      customerId: user.sub,
      accountNumber: details.accountNumber,
      bankName: details.bankName,
      expiresAt: details.expiresAt,
    });
    revalidatePath("/fund-wallet");
    revalidatePath("/dashboard");
    return {
      ok: true,
      value: {
        accountNumber: fundingIntent.accountNumber ?? details.accountNumber,
        bankName: fundingIntent.bankName ?? details.bankName,
        accountName: name,
        amount: fundingIntent.amountKobo / 100,
        reference: fundingIntent.reference,
      },
    };
  } catch (error) {
    console.error("[funding] Temporary account setup failed", error instanceof Error ? error.name : "Unknown error");
    return {
      ok: false,
      error: "We couldn't create a temporary account. If this keeps happening, contact support.",
    };
  }
}
