"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, Modal, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import type { Provider } from "@/lib/admin/providers";
import type { ActionResult } from "@/app/admin/gateways/providers/actions";

export function NetworkCodesDialog({
  provider,
  networks,
  onSubmit,
  onClose,
}: {
  provider: Provider;
  networks: { id: string; name: string }[];
  onSubmit: (input: { networkId: string; code: string }[]) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const base = useId();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(networks.map((network) => [network.id, provider.networkCodes[network.id] ?? ""])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await onSubmit(
          networks
            .map((network) => ({ networkId: network.id, code: values[network.id] ?? "" }))
            .filter((item) => item.code.trim()),
        );
        if (result.ok) {
          toast.success("Network codes saved");
          onClose();
        } else {
          setError(result.error);
        }
      } catch (cause) {
        console.error("[providers] Failed to save network codes", cause);
        setError("Could not save network codes. Please try again.");
      }
    });
  }

  return (
    <Modal title={`Network codes for ${provider.name}`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <FormError>{error}</FormError>}

        {networks.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">No networks have been added yet.</p>
        ) : (
          <div className="space-y-3">
            {networks.map((network) => (
              <Field
                key={network.id}
                id={`${base}-${network.id}`}
                label={network.name}
                hint="Leave blank if this network is not mapped for this provider."
              >
                <input
                  id={`${base}-${network.id}`}
                  value={values[network.id] ?? ""}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [network.id]: event.target.value.trimStart() }))
                  }
                  maxLength={40}
                  spellCheck={false}
                  className={`${inputClass()} font-[family-name:var(--font-geist-mono)] text-sm`}
                  placeholder="1"
                />
              </Field>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : "Save codes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
