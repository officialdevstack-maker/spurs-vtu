import "server-only";
import { markRefunded } from "@/lib/db/transactions";
import { creditCashback, getCashbackBalance, spendCashback } from "@/lib/cashback";
import { creditWallet, debitWallet } from "@/lib/wallet";

const round2 = (value: number) => Math.round(value * 100) / 100;
export type Charge = { cashbackUsed: number; walletPart: number };

export async function quoteCharge(customerId: string, price: number, useCashback: boolean): Promise<Charge> {
  if (!useCashback) return { cashbackUsed: 0, walletPart: price };
  const cashbackUsed = round2(Math.min(await getCashbackBalance(customerId), price));
  return { cashbackUsed, walletPart: round2(price - cashbackUsed) };
}

export async function takePayment(customerId: string, charge: Charge, reference: string): Promise<boolean> {
  if (charge.cashbackUsed > 0 && !(await spendCashback(customerId, charge.cashbackUsed, `${reference}:cb`))) {
    return false;
  }
  if (charge.walletPart <= 0) return true;
  const paid = await debitWallet(customerId, charge.walletPart, reference);
  if (!paid && charge.cashbackUsed > 0) {
    await creditCashback(customerId, charge.cashbackUsed, `${reference}:cb-undo`, "restore");
  }
  return paid;
}

export async function refundPurchase(
  customerId: string,
  amount: number,
  cashbackUsed: number,
  reference: string,
): Promise<boolean> {
  const walletPart = round2(amount - cashbackUsed);
  let ok = true;
  if (walletPart > 0) ok = (await creditWallet(customerId, walletPart, `${reference}:refund`)) && ok;
  if (cashbackUsed > 0) ok = (await creditCashback(customerId, cashbackUsed, `${reference}:refund-cb`, "restore")) && ok;
  return ok;
}

export async function refundAndMark(
  customerId: string,
  amount: number,
  cashbackUsed: number,
  reference: string,
): Promise<boolean> {
  try {
    if (await refundPurchase(customerId, amount, cashbackUsed, reference)) {
      await markRefunded(reference);
      return true;
    }
  } catch (error) {
    console.error("[refund] Refund call failed", reference, error);
  }
  console.error("[refund] Refund needed", reference);
  return false;
}
