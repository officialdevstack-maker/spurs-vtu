"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { Field, FormError, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import { discountsUrl, type AirtimeDiscount, type DataTypeOption } from "@/lib/admin/airtime-data";
import { formatNaira } from "@/lib/format";
import { createDiscount, updateDiscount } from "@/app/admin/products/airtime-data/actions";

type Errors = Partial<Record<"type" | "min" | "max" | "discount" | "form", string>>;
const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

export function DiscountForm({
  network,
  types,
  discount,
}: {
  network: { id: string; name: string };
  types: DataTypeOption[];
  discount?: AirtimeDiscount;
}) {
  const router = useRouter();
  const base = useId();
  const back = discountsUrl(network.id);
  const [type, setType] = useState(discount?.type ?? types[0]?.id ?? "");
  const [min, setMin] = useState(discount ? String(discount.min) : "");
  const [max, setMax] = useState(discount ? String(discount.max) : "");
  const [percent, setPercent] = useState(discount ? String(discount.discount) : "");
  const [active, setActive] = useState(discount?.active ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  const minValue = toNumber(min);
  const maxValue = toNumber(max);
  const discountValue = toNumber(percent);
  const rangeValid = Number.isFinite(minValue) && Number.isFinite(maxValue) && maxValue >= minValue;
  const discountValid = Number.isFinite(discountValue) && discountValue >= 0 && discountValue <= 100;
  const sample = rangeValid ? Math.min(Math.max(1000, minValue), maxValue) : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const nextErrors: Errors = {};
    if (!type) nextErrors.type = "Pick an airtime network type.";
    if (!Number.isFinite(minValue) || minValue < 0) nextErrors.min = "Enter the smallest amount, 0 or more.";
    if (!Number.isFinite(maxValue) || maxValue < 0) nextErrors.max = "Enter the largest amount.";
    else if (Number.isFinite(minValue) && maxValue < minValue) nextErrors.max = "Max can't be below the min amount.";
    if (!discountValid) nextErrors.discount = "Enter a number from 0 to 100.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = { type, min: minValue, max: maxValue, discount: discountValue, active };
    startTransition(async () => {
      try {
        const result = discount
          ? await updateDiscount(network.id, discount.id, input)
          : await createDiscount(network.id, input);
        if (result.ok) router.push(back);
        else setErrors({ form: result.error });
      } catch (error) {
        console.error("[airtime-data] Failed to save discount", error);
        setErrors({ form: "Could not save the discount. Please try again." });
      }
    });
  }

  if (types.length === 0) {
    return (
      <div className="max-w-xl rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
        <p className="font-medium">No airtime types on {network.name}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Add an airtime network type, or switch one on for {network.name}, in the Network types tab first.
        </p>
        <Link href={back} className={`${btnPrimary} mt-4 inline-flex items-center`}>
          Back to discounts
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="max-w-xl space-y-5 rounded-2xl border border-gray-200 bg-gray-100 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6"
    >
      {errors.form && <FormError>{errors.form}</FormError>}
      <div>
        <p className="mb-2 text-sm font-medium">Network</p>
        <p className="flex h-12 items-center rounded-xl border border-gray-200 bg-white/60 px-4 text-base text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-[#9FB3B7]">
          {network.name}
        </p>
      </div>

      <Field id={`${base}-type`} label="Network type" hint="Only airtime types switched on for this network." error={errors.type}>
        <select
          id={`${base}-type`}
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-invalid={!!errors.type}
          className={inputClass(!!errors.type)}
        >
          {types.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${base}-min`} label="Min amount (₦)" hint="Smallest purchase it covers." error={errors.min}>
          <input
            id={`${base}-min`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            autoFocus={!discount}
            value={min}
            onChange={(event) => setMin(event.target.value)}
            aria-invalid={!!errors.min}
            className={`${inputClass(!!errors.min)} tabular-nums`}
          />
        </Field>
        <Field id={`${base}-max`} label="Max amount (₦)" hint="Largest purchase it covers." error={errors.max}>
          <input
            id={`${base}-max`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={max}
            onChange={(event) => setMax(event.target.value)}
            aria-invalid={!!errors.max}
            className={`${inputClass(!!errors.max)} tabular-nums`}
          />
        </Field>
      </div>

      <Field
        id={`${base}-discount`}
        label="Discount (%)"
        hint={
          discountValid && sample !== null
            ? `On ${formatNaira(sample)} airtime, the customer pays ${formatNaira(sample * (1 - discountValue / 100))}.`
            : "Percentage taken off airtime in this range."
        }
        error={errors.discount}
      >
        <input
          id={`${base}-discount`}
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.1"
          value={percent}
          onChange={(event) => setPercent(event.target.value)}
          aria-invalid={!!errors.discount}
          className={`${inputClass(!!errors.discount)} tabular-nums`}
        />
      </Field>

      <label className="flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="size-5 accent-[#1E8E4F]"
        />
        Apply this discount to customers
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <Link href={back} className={`${btnGhost} inline-flex items-center`}>Cancel</Link>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : discount ? "Save discount" : "Add discount"}
        </button>
      </div>
    </form>
  );
}
