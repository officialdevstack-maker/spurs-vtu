import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { WebhooksManager } from "@/components/admin/webhooks/manager";
import { requirePermission } from "@/lib/admin/auth";
import { webhookPath, type ProviderWebhook } from "@/lib/admin/webhooks";
import {
  getAutoFailMinutes,
  getPendingSummary,
  listProviderWebhooks,
  listWebhookEvents,
} from "@/lib/db/webhooks";

export const metadata: Metadata = { title: "Webhooks | Spur VTU" };

async function baseUrl(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
      throw new Error("APP_URL must use HTTPS except for localhost.");
    }
    return url.origin;
  }

  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() ?? h.get("host");
  if (!host) throw new Error("APP_URL is not set and the request host is unavailable.");
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto ?? (local ? "http" : "https");
  if (proto !== "https" && !(local && proto === "http")) {
    throw new Error("The webhook URL base must use HTTPS.");
  }
  return new URL(`${proto}://${host}`).origin;
}

export default async function WebhooksPage() {
  await connection();
  await requirePermission("settings.manage");
  const [base, providers, events, pending, autoFailMinutes] = await Promise.all([
    baseUrl(),
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
