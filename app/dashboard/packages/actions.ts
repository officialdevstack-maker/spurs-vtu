"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSpursUser } from "@spurs-cloud/accounts/next";
import { CUSTOMER_PACKAGES_PATH } from "@/lib/admin/packages";
import { changeCustomerPackage, getCustomerPackage, getPackage } from "@/lib/db/packages";

export type UpgradeResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): UpgradeResult => ({ ok: false, error });

/**
 * TODO: connect this to your SpursWallet debit call. It must take `amount` (NGN) off the
 * customer's wallet using `reference` so a retry can't charge twice, and return true only
 * if the money was taken. Until then paid upgrades fail safely and nobody is charged.
 */
async function debitWallet(customerId: string, amount: number, reference: string): Promise<boolean> {
  void customerId;
  void amount;
  void reference;
  return false;
}

export async function upgradePackage(packageId: string): Promise<UpgradeResult> {
  const user = await requireSpursUser();
  if (!packageId) return fail("That change isn't valid. Refresh the page and try again.");

  const [current, target] = await Promise.all([getCustomerPackage(user.sub), getPackage(packageId)]);
  if (!current || !target) return fail("That package no longer exists. Refresh the page.");
  if (target.id === current.id) return fail("You're already on this package.");
  if (target.sortOrder <= current.sortOrder) return fail("You can only upgrade to a higher package.");

  const reference = randomUUID();
  try {
    if (target.upgradeFee > 0) {
      const paid = await debitWallet(user.sub, target.upgradeFee, reference);
      if (!paid) return fail("We couldn't take the fee from your wallet. Check your balance and try again.");
    }

    if (!(await changeCustomerPackage(user.sub, current.id, target.id, target.upgradeFee, reference))) {
      if (target.upgradeFee > 0) console.error("[packages] Charged but not moved, refund needed", reference);
      return fail("Your package changed while you were upgrading. Refresh the page.");
    }
  } catch (error) {
    console.error("[packages] Upgrade failed", reference, error);
    return fail("Something went wrong. Check your wallet before trying again.");
  }

  revalidatePath(CUSTOMER_PACKAGES_PATH);
  revalidatePath("/dashboard");
  return { ok: true };
}
