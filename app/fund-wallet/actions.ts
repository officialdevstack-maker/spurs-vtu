"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { accountDetails, getFlutterwave } from "@/lib/flutterwave";
import {
  createFundingIntent,
  getFlutterwaveAccount,
  reserveFlutterwaveAccount,
  saveFlutterwaveAccount,
  saveFundingIntentAccount,
} from "@/lib/db/wallet";
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

export async function createTemporaryFundingAccount(
  amountInput: string,
): Promise<FundingActionResult<FundingAccountResult & { amount: number; reference: string }>> {
  const user = await requireSpursUser();
  const amount = Number(amountInput);
  const amountKobo = Math.round(amount * 100);
  if (
    !/^\d{1,7}(?:\.\d{1,2})?$/.test(amountInput) ||
    !Number.isFinite(amount) ||
    !Number.isSafeInteger(amountKobo) ||
    amountKobo < 10_000 ||
    amountKobo > 100_000_000
  ) {
    return { ok: false, error: "Enter a funding amount from ₦100 to ₦1,000,000." };
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
