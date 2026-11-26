"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/dashboard/copy-button";
import type { ApiWebhook, WebhookDelivery } from "@/lib/db/api-webhooks";
import { formatWhen } from "@/lib/format";
import { removeWebhook, rotateWebhookSecret, saveWebhook, type WebhookResult } from "./webhook-actions";

const input = "h-11 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]";

export function WebhookManager({ webhook, deliveries }: { webhook: ApiWebhook | null; deliveries: WebhookDelivery[] }) {
  const router = useRouter();
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [enabled, setEnabled] = useState(webhook?.enabled ?? true);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<WebhookResult>) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) return setError(result.error);
        if (result.secret) setSecret(result.secret);
        router.refresh();
      } catch {
        setError("Could not complete that. Please try again.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <h2 className="font-semibold">Order webhook</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">We POST to this address when an order succeeds or fails.</p>
      {secret && (
        <div role="status" className="mt-4 rounded-xl border border-[#F2B632]/60 bg-[#FFF8E1] p-4 dark:border-[#F2B632]/30 dark:bg-[#F2B632]/10">
          <p className="text-sm font-semibold">Copy your signing secret now</p>
          <p className="mt-2 break-all rounded-lg bg-white p-3 font-mono text-xs dark:bg-black/30">{secret}</p>
          <div className="mt-3 flex gap-3"><CopyButton value={secret} label="Copy secret" /><button type="button" className="text-sm font-medium underline" onClick={() => setSecret(null)}>I&apos;ve saved it</button></div>
        </div>
      )}
      <div className="mt-4 space-y-4">
        <label className="block"><span className="mb-1 block text-sm font-medium">Webhook address</span><input className={input} value={url} maxLength={500} placeholder="https://example.com/vtu-webhook" onChange={(e) => setUrl(e.target.value)} /></label>
        {webhook && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Send events</label>}
        {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={pending} onClick={() => run(() => saveWebhook({ url, enabled }))} className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] disabled:opacity-60">{pending ? "Working..." : webhook ? "Save" : "Create webhook"}</button>
          {webhook && <><button type="button" disabled={pending} onClick={() => run(rotateWebhookSecret)} className="h-11 rounded-xl border border-gray-300 px-5 text-sm font-semibold disabled:opacity-60">New secret</button><button type="button" disabled={pending} onClick={() => run(removeWebhook)} className="h-11 rounded-xl border border-[#C8432B] px-5 text-sm font-semibold text-[#C8432B] disabled:opacity-60">Remove</button></>}
        </div>
      </div>
      {webhook && (
        <div className="mt-6"><h3 className="text-sm font-semibold">Recent deliveries</h3>
          {deliveries.length === 0 ? <p className="mt-2 text-sm text-gray-600">Nothing sent yet.</p> :
            <ul className="mt-2 divide-y divide-gray-200 text-sm">{deliveries.map((d) => (
              <li key={d.id} className="py-2"><p><span className="font-mono text-xs">{d.event}</span> · {d.status === "delivered" ? "Delivered" : d.status === "pending" ? "Retrying" : "Gave up"}{d.httpStatus ? ` (${d.httpStatus})` : ""}</p><p className="break-all text-xs text-gray-600">{d.reference} · {d.attempts} attempt{d.attempts === 1 ? "" : "s"} · {formatWhen(d.at)}{d.lastError && d.status !== "delivered" ? ` · ${d.lastError}` : ""}</p></li>
            ))}</ul>}
        </div>
      )}
    </section>
  );
}
