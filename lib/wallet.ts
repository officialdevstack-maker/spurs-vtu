import "server-only";
import { changeWalletBalance, getWalletBalanceKobo } from "@/lib/db/wallet";

function amountInKobo(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Wallet amounts must be positive and finite.");
  }

  const kobo = Math.round(amount * 100);
  if (!Number.isSafeInteger(kobo) || Math.abs(amount * 100 - kobo) > 1e-6) {
    throw new Error("Wallet amounts must be representable in whole kobo.");
  }
  return kobo;
}

/** The customer's NGN balance in naira, or null if the wallet cannot be reached. */
export async function getNairaBalance(customerId: string): Promise<number | null> {
  try {
    const minorUnits = await getWalletBalanceKobo(customerId);
    if (minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("Wallet balance exceeds the supported display range.");
    }
    return Number(minorUnits) / 100;
  } catch (error) {
    console.error("[wallet] Could not read balance", error);
    return null;
  }
}

export async function debitWallet(customerId: string, amount: number, reference: string): Promise<boolean> {
  return changeWalletBalance({
    customerId,
    amountKobo: amountInKobo(amount),
    reference,
    direction: "debit",
    source: "purchase",
  });
}

export async function creditWallet(customerId: string, amount: number, reference: string): Promise<boolean> {
  return changeWalletBalance({
    customerId,
    amountKobo: amountInKobo(amount),
    reference,
    direction: "credit",
    source: "refund",
  });
}
