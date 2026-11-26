import "server-only";
import { randomUUID } from "node:crypto";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import { changeCustomerPackage, getCustomerPackage, getPackage } from "@/lib/db/packages";
import { verifyPin } from "@/lib/db/pin";
import { creditWallet, debitWallet } from "@/lib/wallet";

export type PackageUpgradeResult = { ok: true } | { ok: false; error: string };

export async function upgradePackage(
  customerId: string,
  packageId: string,
  pin: unknown,
): Promise<PackageUpgradeResult> {
  const checked = await verifyPin(customerId, pin);
  if (!checked.ok) return checked;
  const customer = await getCustomerForPurchase(customerId);
  if (!customer || customer.status !== "active") {
    return { ok: false, error: "Your account is suspended or unavailable." };
  }
  const [current, target] = await Promise.all([getCustomerPackage(customerId), getPackage(packageId)]);
  if (!current || !target) return { ok: false, error: "That package no longer exists." };
  if (target.id === current.id) return { ok: false, error: "You are already on this package." };
  if (target.sortOrder <= current.sortOrder) return { ok: false, error: "You can only upgrade to a higher package." };

  const reference = randomUUID();
  let charged = false;
  try {
    if (target.upgradeFee > 0) {
      const paid = await debitWallet(customerId, target.upgradeFee, reference);
      if (!paid) return { ok: false, error: "The upgrade fee could not be taken from your wallet." };
      charged = true;
    }
    const changed = await changeCustomerPackage(customerId, current.id, target.id, target.upgradeFee, reference);
    if (!changed) {
      if (charged) await creditWallet(customerId, target.upgradeFee, `${reference}:refund`);
      return { ok: false, error: "Your package changed while upgrading. Refresh and try again." };
    }
    return { ok: true };
  } catch (error) {
    if (charged) await creditWallet(customerId, target.upgradeFee, `${reference}:refund`).catch(() => false);
    throw error;
  }
}
