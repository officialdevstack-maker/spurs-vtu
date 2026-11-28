"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, Modal, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import type { Provider } from "@/lib/admin/providers";
import type { ActionResult } from "@/app/admin/gateways/providers/actions";

export function CableCodesDialog({
  provider,
  operators,
  onSubmit,
  onClose,
}: {
  provider: Provider;
  operators: { id: string; name: string }[];
  onSubmit: (input: { operatorId: string; code: string }[]) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const base = useId();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(operators.map((operator) => [operator.id, provider.cableCodes[operator.id] ?? ""])),
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
          operators
            .map((operator) => ({ operatorId: operator.id, code: values[operator.id] ?? "" }))
            .filter((item) => item.code.trim()),
        );
        if (result.ok) {
          toast.success("Cable operator codes saved");
          onClose();
        } else {
          setError(result.error);
        }
      } catch (cause) {
        console.error("[providers] Failed to save cable operator codes", cause);
        setError("Could not save cable operator codes. Please try again.");
      }
    });
  }

  return (
    <Modal title={`Cable operator codes for ${provider.name}`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <FormError>{error}</FormError>}

        {operators.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">No cable operators have been added yet.</p>
        ) : (
          <div className="space-y-3">
            {operators.map((operator) => (
              <Field
                key={operator.id}
                id={`${base}-${operator.id}`}
                label={operator.name}
                hint="Enter this provider's cable ID. Leave blank if it is not supported."
              >
                <input
                  id={`${base}-${operator.id}`}
                  value={values[operator.id] ?? ""}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [operator.id]: event.target.value.trimStart() }))
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
