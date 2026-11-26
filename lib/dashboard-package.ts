import "server-only";
import type { DashboardData } from "@/lib/dashboard-data";
import { getCustomerPackage, listPackages } from "@/lib/db/packages";

export async function getPackageCard(
  customerId: string,
  balance: number | null,
): Promise<DashboardData["package"] | null> {
  const [current, all] = await Promise.all([getCustomerPackage(customerId), listPackages()]);
  if (!current) return null;

  const next = all.find((pkg) => pkg.sortOrder > current.sortOrder);
  const funds = balance ?? 0;

  return {
    name: current.name,
    perks: [current.description || "Package rates apply to every purchase."],
    next: next
      ? {
          name: next.name,
          remaining: Math.max(0, next.upgradeFee - funds),
          progress: next.upgradeFee > 0 ? Math.min(1, funds / next.upgradeFee) : 1,
        }
      : undefined,
  };
}
