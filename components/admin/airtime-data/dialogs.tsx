"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, Modal, btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import type { ActionResult } from "@/app/admin/products/airtime-data/actions";

export function NameDialog({
  title,
  label,
  initial = "",
  submitLabel,
  hint,
  maxLength = 40,
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  initial?: string;
  submitLabel: string;
  hint?: string;
  maxLength?: number;
  onSubmit: (name: string) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!value.trim()) {
      setError("Enter a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(value);
      if (result.ok) {
        toast.success("Saved successfully");
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field id={id} label={label} hint={hint} error={error ?? undefined}>
          <input
            id={id}
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={maxLength}
            aria-invalid={!!error}
            aria-describedby={error || hint ? `${id}-note` : undefined}
            className={inputClass(!!error)}
          />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => Promise<ActionResult>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await onConfirm();
      if (result.ok) {
        toast.success("Deleted successfully");
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-base text-gray-600 dark:text-[#9FB3B7]">{text}</p>
      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={btnGhost}>
          Cancel
        </button>
        <button type="button" onClick={confirm} disabled={pending} className={btnDanger}>
          {pending ? "Deleting…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
