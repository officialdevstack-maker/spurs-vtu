"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSpursUser } from "@spurs-cloud/accounts/next";
import { CUSTOMER_PACKAGES_PATH } from "@/lib/admin/packages";
import { changeCustomerPackage, getCustomerPackage, getPackage } from "@/lib/db/packages";
import { debitWallet } from "@/lib/wallet";

export type UpgradeResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): UpgradeResult => ({ ok: false, error });

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
