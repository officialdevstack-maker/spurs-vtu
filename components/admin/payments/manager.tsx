"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteFlutterwaveProvider, saveFlutterwaveProvider, type PaymentActionResult } from "@/app/admin/gateways/payment/actions";
import { ConfirmDialog } from "@/components/admin/airtime-data/dialogs";
import {
  Field,
  FormError,
  btnDanger,
  btnPrimary,
  inputClass,
} from "@/components/admin/modal";
import { Switch } from "@/components/admin/airtime-data/panels";
import type { PaymentProviderSettings } from "@/lib/db/payment-providers";

function CredentialField({
  id,
  label,
  saved,
  hint,
}: {
  id: string;
  label: string;
  saved: boolean;
  hint: string;
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
        maxLength={2000}
        className={inputClass()}
      />
    </Field>
  );
}

export function PaymentProvidersManager({ settings }: { settings: PaymentProviderSettings | null }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      setConfirmDelete(false);
      setEnabled(true);
      router.refresh();
    }
    return result;
  }

  return (
    <div className="space-y-5">
      {error && <FormError>{error}</FormError>}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5 sm:p-6">
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
                onClick={() => setConfirmDelete(true)}
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

      <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
        Set <code className="font-[family-name:var(--font-geist-mono)]">PROVIDER_SECRET_KEY</code> in the server
        environment before saving credentials. Add <code className="font-[family-name:var(--font-geist-mono)]">
          /api/webhooks/flutterwave
        </code> to your Flutterwave webhook settings.
      </p>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Flutterwave?"
          text="This removes the stored credentials. It can only be deleted before customer virtual accounts and payment records are created."
          confirmLabel="Delete provider"
          onClose={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
