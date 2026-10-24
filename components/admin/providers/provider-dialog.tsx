"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, Modal, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import { AUTH_TYPES, KINDS, type AuthType, type Provider, type ProviderKind } from "@/lib/admin/providers";
import type { ProviderFields } from "@/lib/db/providers";
import type { ActionResult } from "@/app/admin/gateways/providers/actions";

export function ProviderDialog({
  provider,
  onSubmit,
  onClose,
}: {
  provider?: Provider;
  onSubmit: (input: ProviderFields) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const base = useId();
  const [name, setName] = useState(provider?.name ?? "");
  const [kind, setKind] = useState<ProviderKind>(provider?.kind ?? "api");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [authType, setAuthType] = useState<AuthType>(provider?.authType ?? "bearer");
  const [authName, setAuthName] = useState(provider?.authName ?? "");
  const [authUsername, setAuthUsername] = useState(provider?.authUsername ?? "");
  const [secret, setSecret] = useState("");
  const [priority, setPriority] = useState(String(provider?.priority ?? 1));
  const [timeoutMs, setTimeoutMs] = useState(String(provider?.timeoutMs ?? 15000));
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const auth = AUTH_TYPES.find((item) => item.id === authType) ?? AUTH_TYPES[0];
  const kindInfo = KINDS.find((item) => item.id === kind);
  const editing = !!provider;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await onSubmit({
          name,
          kind,
          baseUrl,
          authType,
          authName,
          authUsername,
          secret,
          enabled,
          priority: Number(priority),
          timeoutMs: Number(timeoutMs),
        });
        if (result.ok) {
          toast.success(editing ? "Provider updated" : "Provider added");
          onClose();
        } else {
          setError(result.error);
        }
      } catch (cause) {
        console.error("[providers] Failed to save provider", cause);
        setError("Could not save the provider. Please try again.");
      }
    });
  }

  return (
    <Modal title={editing ? `Edit ${provider.name}` : "Add provider"} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <FormError>{error}</FormError>}

        <Field id={`${base}-name`} label="Name">
          <input
            id={`${base}-name`}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            className={inputClass()}
          />
        </Field>

        <Field id={`${base}-kind`} label="Provider type" hint={kindInfo?.hint}>
          <select
            id={`${base}-kind`}
            value={kind}
            onChange={(event) => setKind(event.target.value as ProviderKind)}
            className={inputClass()}
          >
            {KINDS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id={`${base}-url`} label="Base address" hint="Endpoint paths are appended to this address.">
          <input
            id={`${base}-url`}
            type="url"
            inputMode="url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={kind === "api" ? "https://api.example.com" : "http://192.168.1.20:8080"}
            className={inputClass()}
          />
        </Field>

        <Field id={`${base}-auth`} label="Authentication">
          <select
            id={`${base}-auth`}
            value={authType}
            onChange={(event) => setAuthType(event.target.value as AuthType)}
            className={inputClass()}
          >
            {AUTH_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        {auth.extra === "name" && (
          <Field id={`${base}-auth-name`} label={auth.extraLabel ?? "Name"} hint={auth.extraHint}>
            <input
              id={`${base}-auth-name`}
              value={authName}
              onChange={(event) => setAuthName(event.target.value)}
              maxLength={40}
              className={inputClass()}
            />
          </Field>
        )}

        {auth.extra === "username" && (
          <Field id={`${base}-auth-user`} label={auth.extraLabel ?? "Username"}>
            <input
              id={`${base}-auth-user`}
              value={authUsername}
              onChange={(event) => setAuthUsername(event.target.value)}
              autoComplete="off"
              maxLength={100}
              className={inputClass()}
            />
          </Field>
        )}

        {auth.id !== "none" && (
          <Field
            id={`${base}-secret`}
            label={auth.secretLabel}
            hint={
              editing && provider.hasSecret
                ? "Saved and hidden. Leave blank to keep it, or type a new one to replace it."
                : "Stored encrypted. You won't be able to see it again."
            }
          >
            <input
              id={`${base}-secret`}
              type="password"
              autoComplete="new-password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              maxLength={500}
              className={inputClass()}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field id={`${base}-priority`} label="Priority" hint="1 is tried first.">
            <input
              id={`${base}-priority`}
              type="number"
              min={1}
              max={999}
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className={`${inputClass()} tabular-nums`}
            />
          </Field>
          <Field id={`${base}-timeout`} label="Timeout (ms)" hint="How long to wait.">
            <input
              id={`${base}-timeout`}
              type="number"
              min={1000}
              max={60000}
              step={500}
              value={timeoutMs}
              onChange={(event) => setTimeoutMs(event.target.value)}
              className={`${inputClass()} tabular-nums`}
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-5 accent-[#1E8E4F]"
          />
          Provider enabled
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : editing ? "Save provider" : "Add provider"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
