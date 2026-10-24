import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { ProvidersManager } from "@/components/admin/providers/manager";
import { getProviders } from "@/lib/db/providers";

export const metadata: Metadata = { title: "Providers | Spur VTU" };

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  await connection();
  await requirePermission("gateways.manage");
  const { provider } = await searchParams;
  const providers = await getProviders();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Providers</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Vendors you source services from: authentication, provider settings and service endpoints.
        </p>
      </header>

      <ProvidersManager providers={providers} initialProvider={provider} />
    </div>
  );
}
