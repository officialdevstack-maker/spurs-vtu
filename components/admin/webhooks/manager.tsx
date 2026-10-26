"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Receipt, RefreshCw } from "lucide-react";
import { Field, FormError, Modal, btnDanger, btnGhost, btnIcon, btnPrimary, inputClass } from "@/components/admin/modal";
import {
  MAX_MINUTES,
  MIN_AUTO_FAIL_MINUTES,
  RESULT_LABELS,
  type PendingSummary,
  type ProviderWebhook,
  type WebhookEvent,
} from "@/lib/admin/webhooks";
import { formatNumber, formatWhen } from "@/lib/format";
import { failPendingNow, regenerateToken, saveAutoFail } from "@/app/admin/gateways/webhooks/actions";

type Dialog = { kind: "fail-now" } | { kind: "regenerate"; provider: ProviderWebhook } | null;

const muted = "text-gray-600 dark:text-[#9FB3B7]";
const card = "rounded-2xl border border-gray-200 bg-gray-100 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6";
const stat = "rounded-2xl border border-gray-200 bg-gray-100 p-4 dark:border-white/10 dark:bg-white/5";

export function WebhooksManager({
  providers,
  events,
  pending,
  autoFailMinutes,
}: {
  providers: ProviderWebhook[];
  events: WebhookEvent[];
  pending: PendingSummary;
  autoFailMinutes: number;
}) {
  const router = useRouter();
  const base = useId();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [auto, setAuto] = useState(String(autoFailMinutes));
  const [age, setAge] = useState("30");
  const [autoError, setAutoError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const now = new Date();

  function submitAuto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const value = auto.trim();
    const minutes = Number(value);
    if (
      !value ||
      !Number.isInteger(minutes) ||
      (minutes !== 0 && (minutes < MIN_AUTO_FAIL_MINUTES || minutes > MAX_MINUTES))
    ) {
      setAutoError(`Enter 0 to turn it off, or ${MIN_AUTO_FAIL_MINUTES} to ${MAX_MINUTES} minutes.`);
      return;
    }
    setAutoError(null);
    startSaving(async () => {
      try {
        const result = await saveAutoFail(minutes);
        if (result.ok) {
          toast.success(result.message);
          router.refresh();
        } else {
          setAutoError(result.error);
        }
      } catch (error) {
        console.error("[webhooks] Failed to save auto-fail", error);
        setAutoError("Could not save the setting. Please try again.");
      }
    });
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Webhook URL copied");
    } catch {
      toast.error("Could not copy. Select the URL and copy it by hand.");
    }
  }

  function openDialog(next: Dialog) {
    setDialogError(null);
    setDialog(next);
  }

  function closeDialog() {
    if (!saving) setDialog(null);
  }

  function confirmDialog() {
    if (!dialog || saving) return;
    if (dialog.kind === "fail-now") {
      const minutes = Number(age);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_MINUTES) {
        setDialogError(`Enter a whole number from 0 to ${MAX_MINUTES} minutes.`);
        return;
      }
    }

    const selected = dialog;
    setDialogError(null);
    startSaving(async () => {
      try {
        const result =
          selected.kind === "fail-now"
            ? await failPendingNow(Number(age))
            : await regenerateToken(selected.provider.id);
        if (result.ok) {
          toast.success(result.message);
          setDialog(null);
          router.refresh();
        } else {
          setDialogError(result.error);
        }
      } catch (error) {
        console.error("[webhooks] Failed to apply requested change", error);
        setDialogError("Could not complete the request. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <section aria-label="Webhook summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={stat}>
          <p className={`text-sm ${muted}`}>Pending purchases</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(pending.count)}</p>
        </div>
        <div className={stat}>
          <p className={`text-sm ${muted}`}>Providers</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(providers.length)}</p>
        </div>
        <div className={stat}>
          <p className={`text-sm ${muted}`}>Recent callbacks</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(events.length)}</p>
        </div>
        <div className={stat}>
          <p className={`text-sm ${muted}`}>Auto-fail</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {autoFailMinutes === 0 ? "Off" : `${formatNumber(autoFailMinutes)} min`}
          </p>
        </div>
      </section>

      <section aria-labelledby="pending-heading" className={card}>
        <h2 id="pending-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
          Pending transactions
        </h2>
        <p className={`mt-1 text-sm ${muted}`}>
          {pending.count === 0
            ? "Nothing is pending right now."
            : `${formatNumber(pending.count)} pending, the oldest since ${
                pending.oldest ? formatWhen(pending.oldest, now) : "unknown"
              }.`}{" "}
          Failing an order refunds the customer&apos;s wallet. Only do this for orders the provider did not deliver.
        </p>

        {autoError && (
          <div className="mt-4">
            <FormError>{autoError}</FormError>
          </div>
        )}

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <form onSubmit={submitAuto} noValidate className="space-y-3">
            <Field
              id={`${base}-auto`}
              label="Auto-fail after (minutes)"
              hint={`0 turns it off. Otherwise ${MIN_AUTO_FAIL_MINUTES} to ${MAX_MINUTES}. Needs a cron job calling /api/cron/fail-pending.`}
              error={autoError ?? undefined}
            >
              <input
                id={`${base}-auto`}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_MINUTES}
                step={1}
                value={auto}
                aria-invalid={!!autoError}
                onChange={(event) => setAuto(event.target.value)}
                className={`${inputClass(!!autoError)} tabular-nums`}
              />
            </Field>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save setting"}
            </button>
          </form>

          <div className="space-y-3">
            <Field
              id={`${base}-age`}
              label="Fail pending older than (minutes)"
              hint="0 fails every pending purchase, including brand new ones."
            >
              <input
                id={`${base}-age`}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_MINUTES}
                step={1}
                value={age}
                onChange={(event) => setAge(event.target.value)}
                className={`${inputClass()} tabular-nums`}
              />
            </Field>
            <button
              type="button"
              onClick={() => openDialog({ kind: "fail-now" })}
              disabled={pending.count === 0 || saving}
              className={btnGhost}
            >
              Fail pending now
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="urls-heading">
        <h2 id="urls-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
          Provider webhook URLs
        </h2>
        <p className={`mt-1 mb-4 text-sm ${muted}`}>
          Paste a URL into the provider&apos;s website as its callback or notification URL. The provider must send back
          the order <code>reference</code> and a <code>status</code> (success or failed). Treat these URLs like
          passwords.
        </p>

        {providers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
            <Receipt className="mx-auto size-8 text-gray-400" aria-hidden="true" />
            <p className="mt-3 font-medium">No providers yet</p>
            <p className={`mt-1 text-sm ${muted}`}>Add a provider under Gateways, then come back for its URL.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
            {providers.map((provider) => (
              <li key={provider.id} className="flex min-w-0 flex-col gap-3 px-4 py-4 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">
                    {provider.name}
                    {!provider.enabled && (
                      <span className="ml-2 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-white/10">
                        Off
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void copy(provider.url)}
                      aria-label={`Copy webhook URL for ${provider.name}`}
                      title="Copy"
                      className={btnIcon}
                    >
                      <Copy className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDialog({ kind: "regenerate", provider })}
                      aria-label={`Create a new webhook URL for ${provider.name}`}
                      title="Create a new URL"
                      className={btnIcon}
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <input
                  readOnly
                  aria-label={`${provider.name} webhook URL`}
                  value={provider.url}
                  onFocus={(event) => event.currentTarget.select()}
                  className={`${inputClass()} font-[family-name:var(--font-geist-mono)] text-sm`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="events-heading">
        <h2 id="events-heading" className="mb-3 font-[family-name:var(--font-display)] text-lg font-bold">
          Recent callbacks
        </h2>
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
            <Receipt className="mx-auto size-8 text-gray-400" aria-hidden="true" />
            <p className="mt-3 font-medium">No callbacks yet</p>
            <p className={`mt-1 text-sm ${muted}`}>Callbacks from your providers will show up here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
            {events.map((event: WebhookEvent) => (
              <li key={event.id} className="flex min-w-0 items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {event.providerName} reported {event.outcome}
                  </p>
                  <p className={`truncate font-[family-name:var(--font-geist-mono)] text-xs ${muted}`}>
                    {event.reference ?? "No reference"} · {formatWhen(event.at, now)}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-right text-sm ${
                    event.result === "late_success" ? "font-medium text-[#C8432B]" : muted
                  }`}
                >
                  {RESULT_LABELS[event.result]}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog && (
        <Modal
          title={dialog.kind === "fail-now" ? "Fail pending transactions?" : "Create a new webhook URL?"}
          onClose={closeDialog}
        >
          <p className="text-base text-gray-600 dark:text-[#9FB3B7]">
            {dialog.kind === "fail-now"
              ? `Every pending purchase older than ${Number(age) || 0} minutes will be marked failed and refunded to the customer's wallet. If a provider delivers one later, the customer may already have been refunded.`
              : `The current URL for ${dialog.provider.name} will stop working immediately. Update the callback URL on the provider's website after creating the new one.`}
          </p>
          {dialogError && (
            <div className="mt-4">
              <FormError>{dialogError}</FormError>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={closeDialog} disabled={saving} className={btnGhost}>
              Cancel
            </button>
            <button type="button" onClick={confirmDialog} disabled={saving} className={btnDanger}>
              {saving ? "Working…" : dialog.kind === "fail-now" ? "Fail and refund" : "Create new URL"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
