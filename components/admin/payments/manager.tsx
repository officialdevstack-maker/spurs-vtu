"use client";

import { useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteFlutterwaveProvider,
  deletePaymentPointProvider,
  saveFlutterwaveProvider,
  savePaymentPointProvider,
  type PaymentActionResult,
} from "@/app/admin/gateways/payment/actions";
import { ConfirmDialog } from "@/components/admin/airtime-data/dialogs";
import {
  Field,
  FormError,
  btnDanger,
  btnPrimary,
  inputClass,
} from "@/components/admin/modal";
import { Switch } from "@/components/admin/airtime-data/panels";
import type { PaymentPointProviderSettings, PaymentProviderSettings } from "@/lib/db/payment-providers";

function CredentialField({
  id,
  label,
  saved,
  hint,
  maxLength = 2000,
}: {
  id: string;
  label: string;
  saved: boolean;
  hint: string;
  maxLength?: number;
}) {
  return (
    <Field
      id={id}
      label={label}
      hint={saved ? "Saved securely. Leave blank to keep the current value." : hint}
    >
      <input
        id={id}
        name={id}
        type="password"
        autoComplete="new-password"
        maxLength={maxLength}
        className={inputClass()}
      />
    </Field>
  );
}

export function PaymentProvidersManager({
  settings,
  paymentPointSettings,
}: {
  settings: PaymentProviderSettings | null;
  paymentPointSettings: PaymentPointProviderSettings | null;
}) {
  const router = useRouter();
  const [activeProvider, setActiveProvider] = useState<"flutterwave" | "paymentpoint">("flutterwave");
  const flutterwaveTab = useRef<HTMLButtonElement>(null);
  const paymentPointTab = useRef<HTMLButtonElement>(null);
  const [enabled, setEnabled] = useState(settings?.enabled ?? true);
  const [paymentPointEnabled, setPaymentPointEnabled] = useState(paymentPointSettings?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<"flutterwave" | "paymentpoint" | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const input = {
      publicKey: form.get("publicKey"),
      secretKey: form.get("secretKey"),
      webhookHash: form.get("webhookHash"),
      enabled,
    };
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveFlutterwaveProvider(input);
        if (result.ok) {
          toast.success("Payment provider saved");
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch (cause) {
        console.error("[payment-gateway] Failed to save settings", cause);
        setError("Could not save the payment provider. Please try again.");
      }
    });
  }

  async function remove(): Promise<PaymentActionResult> {
    const result = await deleteFlutterwaveProvider();
    if (result.ok) {
      setConfirmDelete(null);
      setEnabled(true);
      router.refresh();
    }
    return result;
  }

  function submitPaymentPoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const input = {
      apiKey: form.get("apiKey"),
      apiSecret: form.get("apiSecret"),
      businessId: form.get("businessId"),
      webhookSecret: form.get("webhookSecret"),
      enabled: paymentPointEnabled,
    };
    setError(null);
    startTransition(async () => {
      try {
        const result = await savePaymentPointProvider(input);
        if (result.ok) {
          toast.success("PaymentPoint settings saved");
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch (cause) {
        console.error("[payment-gateway] Failed to save PaymentPoint settings", cause);
        setError("Could not save PaymentPoint. Please try again.");
      }
    });
  }

  async function removePaymentPoint(): Promise<PaymentActionResult> {
    const result = await deletePaymentPointProvider();
    if (result.ok) {
      setConfirmDelete(null);
      setPaymentPointEnabled(true);
      router.refresh();
    }
    return result;
  }

  function moveProviderTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "flutterwave"
        : event.key === "End"
          ? "paymentpoint"
          : activeProvider === "flutterwave"
            ? "paymentpoint"
            : "flutterwave";
    setActiveProvider(next);
    if (next === "flutterwave") flutterwaveTab.current?.focus();
    else paymentPointTab.current?.focus();
  }

  return (
    <div className="space-y-5">
      {error && <FormError>{error}</FormError>}

      <div
        role="tablist"
        aria-label="Payment gateways"
        className="flex gap-2 border-b border-gray-200 dark:border-white/10"
      >
        <button
          ref={flutterwaveTab}
          id="flutterwave-tab"
          type="button"
          role="tab"
          aria-selected={activeProvider === "flutterwave"}
          aria-controls="flutterwave-panel"
          tabIndex={activeProvider === "flutterwave" ? 0 : -1}
          onClick={() => setActiveProvider("flutterwave")}
          onKeyDown={moveProviderTab}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${
            activeProvider === "flutterwave"
              ? "border-[#F2B632] text-[#12343B] dark:text-white"
              : "border-transparent text-gray-600 dark:text-[#9FB3B7]"
          }`}
        >
          Flutterwave
        </button>
        <button
          ref={paymentPointTab}
          id="paymentpoint-tab"
          type="button"
          role="tab"
          aria-selected={activeProvider === "paymentpoint"}
          aria-controls="paymentpoint-panel"
          tabIndex={activeProvider === "paymentpoint" ? 0 : -1}
          onClick={() => setActiveProvider("paymentpoint")}
          onKeyDown={moveProviderTab}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${
            activeProvider === "paymentpoint"
              ? "border-[#F2B632] text-[#12343B] dark:text-white"
              : "border-transparent text-gray-600 dark:text-[#9FB3B7]"
          }`}
        >
          PaymentPoint
        </button>
      </div>

      <section
        id="flutterwave-panel"
        role="tabpanel"
        aria-labelledby="flutterwave-tab"
        tabIndex={0}
        hidden={activeProvider !== "flutterwave"}
        className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Flutterwave</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
              Credentials are encrypted before they are stored. They are never sent back to this page.
            </p>
          </div>
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium dark:bg-white/10">
            {settings ? "Configured" : "Not configured"}
          </span>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-5">
          <CredentialField
            id="publicKey"
            label="Public key"
            saved={settings?.hasPublicKey ?? false}
            hint="Enter the public key from your Flutterwave dashboard."
            maxLength={1000}
          />
          <CredentialField
            id="secretKey"
            label="Secret key"
            saved={settings?.hasSecretKey ?? false}
            hint="Enter the server-side secret key from your Flutterwave dashboard."
          />
          <CredentialField
            id="webhookHash"
            label="Webhook secret hash"
            saved={settings?.hasWebhookHash ?? false}
            hint="Enter the same secret hash configured for the Flutterwave webhook."
          />

          <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
            <Switch
              checked={enabled}
              label="Allow new Flutterwave virtual accounts"
              onChange={setEnabled}
            />
            <p className="mt-2 text-sm text-gray-600 dark:text-[#9FB3B7]">
              Turning this off prevents new account creation. Existing account payments will still be verified.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {settings ? (
              <button
                type="button"
                onClick={() => setConfirmDelete("flutterwave")}
                disabled={pending}
                className={btnDanger}
              >
                Delete provider
              </button>
            ) : <span />}
            <button type="submit" disabled={pending} className={btnPrimary}>
              {pending ? "Saving…" : settings ? "Save changes" : "Add Flutterwave"}
            </button>
          </div>
        </form>

        {settings && !settings.enabled && (
          <p role="status" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-300/10 dark:text-amber-200">
            Flutterwave is disabled for new accounts. Existing payment notifications remain active.
          </p>
        )}
      </section>

      <section
        id="paymentpoint-panel"
        role="tabpanel"
        aria-labelledby="paymentpoint-tab"
        tabIndex={0}
        hidden={activeProvider !== "paymentpoint"}
        className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">PaymentPoint</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
              Credentials are encrypted before storage and are never sent back to this page.
            </p>
          </div>
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium dark:bg-white/10">
            {paymentPointSettings ? "Configured" : "Not configured"}
          </span>
        </div>

        <form onSubmit={submitPaymentPoint} className="mt-6 space-y-5">
          <CredentialField
            id="apiKey"
            label="API key"
            saved={paymentPointSettings?.hasApiKey ?? false}
            hint="Enter the API key from your PaymentPoint account."
          />
          <CredentialField
            id="apiSecret"
            label="API secret"
            saved={paymentPointSettings?.hasApiSecret ?? false}
            hint="Enter the bearer API secret from your PaymentPoint account."
          />
          <CredentialField
            id="businessId"
            label="Business ID"
            saved={paymentPointSettings?.hasBusinessId ?? false}
            hint="Enter the business ID required by the create virtual account API."
          />
          <CredentialField
            id="webhookSecret"
            label="Webhook security key (optional)"
            saved={paymentPointSettings?.hasWebhookSecret ?? false}
            hint="Enter a separate signing key if PaymentPoint provided one. Otherwise, the API secret is used."
          />

          <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
            <Switch
              checked={paymentPointEnabled}
              label="Allow new PaymentPoint accounts"
              onChange={setPaymentPointEnabled}
            />
            <p className="mt-2 text-sm text-gray-600 dark:text-[#9FB3B7]">
              Turning this off prevents new account creation. Existing account payments will still be processed.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {paymentPointSettings ? (
              <button
                type="button"
                onClick={() => setConfirmDelete("paymentpoint")}
                disabled={pending}
                className={btnDanger}
              >
                Delete provider
              </button>
            ) : <span />}
            <button type="submit" disabled={pending} className={btnPrimary}>
              {pending ? "Saving…" : paymentPointSettings ? "Save changes" : "Add PaymentPoint"}
            </button>
          </div>
        </form>

        {paymentPointSettings && !paymentPointSettings.enabled && (
          <p role="status" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-300/10 dark:text-amber-200">
            PaymentPoint is disabled for new accounts. Existing payment notifications remain active.
          </p>
        )}
      </section>

      <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
        Set <code className="font-[family-name:var(--font-geist-mono)]">PROVIDER_SECRET_KEY</code> in the server
        environment before saving credentials. Configure <code className="font-[family-name:var(--font-geist-mono)]">
          /api/webhooks/flutterwave
        </code> and <code className="font-[family-name:var(--font-geist-mono)]">
          /api/webhooks/paymentpoint
        </code> as the webhook URLs in the corresponding provider dashboards.
      </p>

      {confirmDelete === "flutterwave" && (
        <ConfirmDialog
          title="Delete Flutterwave?"
          text="This removes the stored credentials. It can only be deleted before customer virtual accounts and payment records are created."
          confirmLabel="Delete provider"
          onClose={() => setConfirmDelete(null)}
          onConfirm={remove}
        />
      )}
      {confirmDelete === "paymentpoint" && (
        <ConfirmDialog
          title="Delete PaymentPoint?"
          text="This removes the stored credentials. It can only be deleted before customer accounts and payment records are created."
          confirmLabel="Delete provider"
          onClose={() => setConfirmDelete(null)}
          onConfirm={removePaymentPoint}
        />
      )}
    </div>
  );
}
