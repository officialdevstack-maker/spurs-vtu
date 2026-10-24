"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, Modal, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import type { Package } from "@/lib/admin/packages";
import type { PackageFields } from "@/lib/db/packages";
import type { ActionResult } from "@/app/admin/users/packages/actions";

export function PackageDialog({
  pkg,
  nextOrder,
  onSubmit,
  onClose,
}: {
  pkg?: Package;
  nextOrder: number;
  onSubmit: (input: PackageFields) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const base = useId();
  const [name, setName] = useState(pkg?.name ?? "");
  const [description, setDescription] = useState(pkg?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(pkg?.sortOrder ?? nextOrder));
  const [fee, setFee] = useState(pkg ? String(pkg.upgradeFee) : "0");
  const [isDefault, setIsDefault] = useState(pkg?.isDefault ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!name.trim()) {
      setError("Enter a package name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await onSubmit({
          name,
          description,
          sortOrder: Number(sortOrder),
          upgradeFee: Number(fee),
          isDefault,
        });
        if (result.ok) {
          toast.success(pkg ? "Package updated" : "Package added");
          onClose();
        } else {
          setError(result.error);
        }
      } catch (cause) {
        console.error("[packages] Failed to save package", cause);
        setError("Could not save the package. Please try again.");
      }
    });
  }

  return (
    <Modal title={pkg ? `Edit ${pkg.name}` : "Add package"} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <FormError>{error}</FormError>}

        <Field id={`${base}-name`} label="Name">
          <input
            id={`${base}-name`}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={30}
            className={inputClass()}
          />
        </Field>

        <Field id={`${base}-description`} label="Description" hint="Shown to customers. Optional.">
          <input
            id={`${base}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={160}
            className={inputClass()}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field id={`${base}-fee`} label="Upgrade fee (₦)" hint="One-off. 0 is free.">
            <input
              id={`${base}-fee`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              className={`${inputClass()} tabular-nums`}
            />
          </Field>
          <Field id={`${base}-order`} label="Order" hint="Customers upgrade to a higher number.">
            <input
              id={`${base}-order`}
              type="number"
              min={1}
              max={999}
              step={1}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className={`${inputClass()} tabular-nums`}
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={isDefault}
            disabled={pkg?.isDefault}
            onChange={(event) => setIsDefault(event.target.checked)}
            className="size-5 accent-[#1E8E4F]"
          />
          {pkg?.isDefault ? "Default package (set another to change)" : "Make this the default for new customers"}
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : pkg ? "Save package" : "Add package"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
