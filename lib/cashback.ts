import "server-only";
import { awardCashbackFor, changeCashbackBalance, getCashbackBalanceKobo } from "@/lib/db/cashback";

const kobo = (amount: number) => Math.round(amount * 100);

export async function getCashbackBalance(customerId: string): Promise<number> {
  try {
    return Number(await getCashbackBalanceKobo(customerId)) / 100;
  } catch (error) {
    console.error("[cashback] Could not read balance", error);
    return 0;
  }
}

export const spendCashback = (customerId: string, amount: number, reference: string) =>
  changeCashbackBalance({ customerId, amountKobo: kobo(amount), reference, direction: "debit", source: "spend" });

export const creditCashback = (customerId: string, amount: number, reference: string, source: "restore") =>
  changeCashbackBalance({ customerId, amountKobo: kobo(amount), reference, direction: "credit", source });

export async function awardCashback(transactionId: string): Promise<void> {
  try {
    await awardCashbackFor(transactionId);
  } catch (error) {
    console.error("[cashback] Could not award cashback", transactionId, error);
  }
}
