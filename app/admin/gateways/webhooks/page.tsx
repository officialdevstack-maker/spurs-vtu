import type { Metadata } from "next";
import { connection } from "next/server";
import { WebhooksManager } from "@/components/admin/webhooks/manager";
import { getAppBaseUrl } from "@/lib/admin/app-url";
import { requirePermission } from "@/lib/admin/auth";
import { webhookPath, type ProviderWebhook } from "@/lib/admin/webhooks";
import {
  getAutoFailMinutes,
  getPendingSummary,
  listProviderWebhooks,
  listWebhookEvents,
} from "@/lib/db/webhooks";

export const metadata: Metadata = { title: "Webhooks | Spur VTU" };

export default async function WebhooksPage() {
  await connection();
  await requirePermission("settings.manage");
  const [base, providers, events, pending, autoFailMinutes] = await Promise.all([
    getAppBaseUrl(),
    listProviderWebhooks(),
    listWebhookEvents(),
    getPendingSummary(),
    getAutoFailMinutes(),
  ]);

  const items: ProviderWebhook[] = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    enabled: provider.enabled,
    url: `${base}${webhookPath(provider.token)}`,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Webhooks</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Let providers confirm orders by callback, and decide what happens to orders that never get an answer.
        </p>
      </header>

      <WebhooksManager
        key={autoFailMinutes}
        providers={items}
        events={events}
        pending={pending}
        autoFailMinutes={autoFailMinutes}
      />
    </div>
  );
}
