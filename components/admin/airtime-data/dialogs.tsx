"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, Modal, btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import { formatNaira } from "@/lib/format";
import type { DataPlan, DataTypeOption } from "@/lib/admin/airtime-data";
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
      }
      else setError(result.error);
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
      }
      else setError(result.error);
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

export type PlanInput = {
  type: string;
  size: string;
  validity: string;
  cost: number;
  price: number;
  active: boolean;
};

const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));
type PlanField = "type" | "size" | "validity" | "cost" | "price" | "form";

export function PlanDialog({
  networkName,
  types,
  plan,
  defaultType,
  onSubmit,
  onClose,
}: {
  networkName: string;
  types: DataTypeOption[];
  plan?: DataPlan;
  defaultType?: string;
  onSubmit: (input: PlanInput) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const base = useId();
  const [type, setType] = useState(plan?.type ?? defaultType ?? types[0]?.id ?? "");
  const [size, setSize] = useState(plan?.size ?? "");
  const [validity, setValidity] = useState(plan?.validity ?? "");
  const [cost, setCost] = useState(plan ? String(plan.cost) : "");
  const [price, setPrice] = useState(plan ? String(plan.price) : "");
  const [active, setActive] = useState(plan?.active ?? true);
  const [errors, setErrors] = useState<Partial<Record<PlanField, string>>>({});
  const [pending, startTransition] = useTransition();

  const costN = toNumber(cost);
  const priceN = toNumber(price);
  const margin = Number.isFinite(costN) && Number.isFinite(priceN) ? priceN - costN : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const found: Partial<Record<PlanField, string>> = {};
    if (!type || !types.some((option) => option.id === type)) found.type = "Pick a network type.";
    if (!size.trim()) found.size = "Enter the plan size, like 1GB.";
    if (!validity.trim()) found.validity = "Enter how long it lasts, like 30 days.";
    if (!Number.isFinite(costN) || costN < 0) found.cost = "Enter the cost, 0 or more.";
    if (!Number.isFinite(priceN) || priceN < 0) found.price = "Enter the price, 0 or more.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    startTransition(async () => {
      const result = await onSubmit({ type, size, validity, cost: costN, price: priceN, active });
      if (result.ok) {
        toast.success(plan ? "Plan updated" : "Plan created");
        onClose();
      }
      else setErrors({ form: result.error });
    });
  }

  return (
    <Modal title={plan ? `Edit ${plan.size} plan` : `Add plan to ${networkName}`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {errors.form && <FormError>{errors.form}</FormError>}

        <Field id={`${base}-type`} label="Network type" error={errors.type}>
          <select
            id={`${base}-type`}
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-invalid={!!errors.type}
            aria-describedby={errors.type ? `${base}-type-note` : undefined}
            className={inputClass(!!errors.type)}
          >
            {types.length === 0 && <option value="">No types yet</option>}
            {types.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field id={`${base}-size`} label="Size" error={errors.size}>
            <input
              id={`${base}-size`}
              autoFocus
              value={size}
              onChange={(event) => setSize(event.target.value)}
              placeholder="1GB"
              maxLength={30}
              aria-invalid={!!errors.size}
              aria-describedby={errors.size ? `${base}-size-note` : undefined}
              className={inputClass(!!errors.size)}
            />
          </Field>
          <Field id={`${base}-validity`} label="Validity" error={errors.validity}>
            <input
              id={`${base}-validity`}
              value={validity}
              onChange={(event) => setValidity(event.target.value)}
              placeholder="30 days"
              maxLength={30}
              aria-invalid={!!errors.validity}
              aria-describedby={errors.validity ? `${base}-validity-note` : undefined}
              className={inputClass(!!errors.validity)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field id={`${base}-cost`} label="Cost (₦)" hint="What you pay the provider." error={errors.cost}>
            <input
              id={`${base}-cost`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              aria-invalid={!!errors.cost}
              aria-describedby={`${base}-cost-note`}
              className={`${inputClass(!!errors.cost)} tabular-nums`}
            />
          </Field>
          <Field id={`${base}-price`} label="Price (₦)" hint="What the customer pays." error={errors.price}>
            <input
              id={`${base}-price`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              aria-invalid={!!errors.price}
              aria-describedby={`${base}-price-note`}
              className={`${inputClass(!!errors.price)} tabular-nums`}
            />
          </Field>
        </div>

        {margin !== null && (
          <p className={`text-sm ${margin < 0 ? "text-[#C8432B]" : "text-gray-600 dark:text-[#9FB3B7]"}`}>
            {margin < 0
              ? `You'd lose ${formatNaira(Math.abs(margin))} on each sale.`
              : `You'd earn ${formatNaira(margin)} on each sale.`}
          </p>
        )}

        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="size-5 accent-[#1E8E4F]"
          />
          Show this plan to customers
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={pending || types.length === 0} className={btnPrimary}>
            {pending ? "Saving…" : plan ? "Save plan" : "Add plan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
