"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Field, FormError, Modal, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import { SERVICES, type Service } from "@/lib/admin/airtime-data";
import type { ActionResult } from "@/app/admin/products/airtime-data/actions";

export function TypeDialog({
  defaultService = "data",
  onSubmit,
  onClose,
}: {
  defaultService?: Service;
  onSubmit: (label: string, service: Service) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const id = useId();
  const [label, setLabel] = useState("");
  const [service, setService] = useState<Service>(defaultService);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!label.trim()) {
      setError("Enter a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(label, service);
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  return (
    <Modal title="Add network type" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <fieldset>
          <legend className="mb-2 block text-sm font-medium">Service</legend>
          <div className="grid grid-cols-2 gap-3">
            {SERVICES.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-[#12343B] dark:focus-within:ring-[#F2B632] ${
                  service === option.id
                    ? "border-[#12343B] bg-gray-100 dark:border-[#F2B632] dark:bg-white/10"
                    : "border-gray-300 hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/5"
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-service`}
                  value={option.id}
                  checked={service === option.id}
                  onChange={() => setService(option.id)}
                  className="size-4 accent-[#1E8E4F]"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          id={id}
          label="Type name"
          hint={service === "airtime" ? "For example VTU or Share & Sell." : "For example SME, VTU or Gifting."}
          error={error ?? undefined}
        >
          <input
            id={id}
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={20}
            aria-invalid={!!error}
            className={inputClass(!!error)}
          />
        </Field>

        {error && <FormError>{error}</FormError>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : "Add type"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
