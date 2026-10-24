"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import {
  DATA_UNITS,
  formatVolume,
  plansUrl,
  resolvePackagePrice,
  type DataPlan,
  type DataTypeOption,
  type DataUnit,
  type PackageOption,
  type PackagePrice,
  type PriceMode,
  type ProviderOption,
} from "@/lib/admin/airtime-data";
import { formatNaira } from "@/lib/format";
import { createPlan, updatePlan } from "@/app/admin/products/airtime-data/actions";

type Errors = Partial<
  Record<"type" | "volume" | "validity" | "providerPlanId" | "cost" | "price" | "packagePrices" | "form", string>
>;
type PackageDraft = { mode: PriceMode; value: string };
const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

export function PlanForm({
  network,
  types,
  providers,
  packages,
  plan,
  defaultType,
}: {
  network: { id: string; name: string };
  types: DataTypeOption[];
  providers: ProviderOption[];
  packages: PackageOption[];
  plan?: DataPlan;
  defaultType?: string;
}) {
  const router = useRouter();
  const base = useId();
  const back = plansUrl(network.id);
  const [type, setType] = useState(
    plan?.type ?? (types.some((option) => option.id === defaultType) ? defaultType! : types[0]?.id ?? ""),
  );
  const [volume, setVolume] = useState(plan ? String(plan.volume) : "");
  const [unit, setUnit] = useState<DataUnit>(plan?.unit ?? "gb");
  const [validity, setValidity] = useState(plan?.validity ?? "");
  const [providerId, setProviderId] = useState(plan?.providerId ?? "");
  const [providerPlanId, setProviderPlanId] = useState(plan?.providerPlanId ?? "");
  const [cost, setCost] = useState(plan ? String(plan.cost) : "");
  const [price, setPrice] = useState(plan ? String(plan.price) : "");
  const [packageDrafts, setPackageDrafts] = useState<Record<string, PackageDraft>>(() =>
    Object.fromEntries(
      packages.map((item) => {
        const saved = plan?.packagePrices.find((price) => price.packageId === item.id);
        return [item.id, { mode: saved?.mode ?? "fixed", value: saved ? String(saved.value) : "" }];
      }),
    ),
  );
  const [active, setActive] = useState(plan?.active ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  const volumeValue = toNumber(volume);
  const costValue = toNumber(cost);
  const priceValue = toNumber(price);
  const volumeValid = Number.isFinite(volumeValue) && volumeValue > 0;
  const priceValid = Number.isFinite(priceValue) && priceValue >= 0;
  const margin = Number.isFinite(costValue) && Number.isFinite(priceValue) ? priceValue - costValue : null;

  function updateDraft(packageId: string, patch: Partial<PackageDraft>) {
    setPackageDrafts((current) => ({ ...current, [packageId]: { ...current[packageId], ...patch } }));
    if (errors.packagePrices) setErrors((previous) => ({ ...previous, packagePrices: undefined }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const nextErrors: Errors = {};
    if (!type || !types.some((option) => option.id === type)) nextErrors.type = "Pick a network type.";
    if (!volumeValid) nextErrors.volume = "Enter the amount of data, more than 0.";
    if (!validity.trim()) nextErrors.validity = "Enter how long it lasts, like 30 days.";
    if (providerId && !providerPlanId.trim()) nextErrors.providerPlanId = "Enter the provider's plan ID.";
    if (!Number.isFinite(costValue) || costValue < 0) nextErrors.cost = "Enter the provider cost, 0 or more.";
    if (!Number.isFinite(priceValue) || priceValue < 0) nextErrors.price = "Enter the price, 0 or more.";
    const packagePrices: PackagePrice[] = [];
    for (const item of packages) {
      const draft = packageDrafts[item.id];
      if (!draft || draft.value.trim() === "") continue;
      const value = toNumber(draft.value);
      const tooHigh = draft.mode === "percent" && value > 100;
      if (!Number.isFinite(value) || value < 0 || tooHigh) {
        nextErrors.packagePrices = `${item.name}: enter ${
          draft.mode === "percent" ? "a percentage from 0 to 100" : "an amount, 0 or more"
        }, or leave it blank.`;
        break;
      }
      packagePrices.push({ packageId: item.id, mode: draft.mode, value });
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      type,
      volume: volumeValue,
      unit,
      validity,
      cost: costValue,
      price: priceValue,
      packagePrices,
      providerId: providerId || null,
      providerPlanId,
      active,
    };
    startTransition(async () => {
      try {
        const result = plan
          ? await updatePlan(network.id, plan.id, input)
          : await createPlan(network.id, input);
        if (result.ok) {
          toast.success(plan ? "Plan updated" : "Plan created");
          router.push(back);
        } else {
          setErrors({ form: result.error });
        }
      } catch (error) {
        console.error("[airtime-data] Failed to save plan", error);
        setErrors({ form: "Could not save the plan. Please try again." });
      }
    });
  }

  if (types.length === 0) {
    return (
      <div className="max-w-xl rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
        <p className="font-medium">No data types on {network.name}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Add a data network type, or switch one on for {network.name}, in the Network types tab first.
        </p>
        <Link href={back} className={`${btnPrimary} mt-4 inline-flex items-center`}>
          Back to data plans
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

      <Field id={`${base}-type`} label="Network type" hint="Only data types switched on for this network." error={errors.type}>
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
        <Field
          id={`${base}-volume`}
          label="Data volume"
          hint={volumeValid ? `Customers see ${formatVolume(volumeValue, unit)}.` : "For example 200 (MB) or 2 (GB)."}
          error={errors.volume}
        >
          <input
            id={`${base}-volume`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            autoFocus={!plan}
            value={volume}
            onChange={(event) => setVolume(event.target.value)}
            aria-invalid={!!errors.volume}
            className={`${inputClass(!!errors.volume)} tabular-nums`}
          />
        </Field>
        <Field id={`${base}-unit`} label="Unit">
          <select
            id={`${base}-unit`}
            value={unit}
            onChange={(event) => setUnit(event.target.value as DataUnit)}
            className={inputClass()}
          >
            {DATA_UNITS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field id={`${base}-validity`} label="Validity" hint="How long the plan lasts." error={errors.validity}>
        <input
          id={`${base}-validity`}
          value={validity}
          onChange={(event) => setValidity(event.target.value)}
          placeholder="30 days"
          maxLength={30}
          aria-invalid={!!errors.validity}
          className={inputClass(!!errors.validity)}
        />
      </Field>

      <fieldset className="space-y-5 rounded-xl border border-gray-200 p-4 dark:border-white/10">
        <legend className="px-2 text-sm font-medium">Provider</legend>
        <Field
          id={`${base}-provider`}
          label="Fulfilled by"
          hint={
            providers.length === 0
              ? "No provider has an active data endpoint yet. Add one under Gateways > Providers."
              : "Purchases of this plan go to this provider. Leave on any provider to use provider priority."
          }
        >
          <select
            id={`${base}-provider`}
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
            className={inputClass()}
          >
            <option value="">Any provider (by priority)</option>
            {providers.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </Field>

        <Field
          id={`${base}-provider-plan`}
          label="Provider plan ID"
          hint="The provider's own ID for this plan. Sent as {plan} in the endpoint body."
          error={errors.providerPlanId}
        >
          <input
            id={`${base}-provider-plan`}
            value={providerPlanId}
            onChange={(event) => setProviderPlanId(event.target.value)}
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!errors.providerPlanId}
            className={`${inputClass(!!errors.providerPlanId)} font-[family-name:var(--font-geist-mono)] text-sm`}
          />
        </Field>

        <Field id={`${base}-cost`} label="Provider cost (₦)" hint="What you pay the provider." error={errors.cost}>
          <input
            id={`${base}-cost`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            aria-invalid={!!errors.cost}
            className={`${inputClass(!!errors.cost)} tabular-nums`}
          />
        </Field>
      </fieldset>

      <Field id={`${base}-price`} label="Selling price (₦)" hint="What the customer pays." error={errors.price}>
        <input
          id={`${base}-price`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          aria-invalid={!!errors.price}
          className={`${inputClass(!!errors.price)} tabular-nums`}
        />
      </Field>

      {margin !== null && (
        <p className={`text-sm ${margin < 0 ? "text-[#C8432B]" : "text-gray-600 dark:text-[#9FB3B7]"}`}>
          {margin < 0
            ? `You'd lose ${formatNaira(Math.abs(margin))} on each sale.`
            : `You'd earn ${formatNaira(margin)} on each sale.`}
        </p>
      )}

      <fieldset className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-white/10">
        <legend className="px-2 text-sm font-medium">Package prices</legend>
        {errors.packagePrices ? (
          <p role="alert" className="text-sm text-[#C8432B]">
            {errors.packagePrices}
          </p>
        ) : (
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            Set what each package pays, as a fixed amount or a percentage off the standard price. Leave it blank to use
            the standard price.
          </p>
        )}

        {packages.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">No packages yet.</p>
        ) : (
          <ul className="space-y-4">
            {packages.map((item) => {
              const draft = packageDrafts[item.id] ?? { mode: "fixed" as PriceMode, value: "" };
              const valueN = toNumber(draft.value);
              const valueOk = Number.isFinite(valueN) && valueN >= 0 && (draft.mode === "fixed" || valueN <= 100);
              const result = valueOk && priceValid ? resolvePackagePrice(priceValue, draft.mode, valueN) : null;
              const itemMargin = result !== null && Number.isFinite(costValue) ? result - costValue : null;
              const inputId = `${base}-package-${item.id}`;
              return (
                <li key={item.id}>
                  <label htmlFor={inputId} className="mb-2 block text-sm font-medium">
                    {item.name}
                  </label>
                  <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
                    <select
                      aria-label={`How to price ${item.name}`}
                      value={draft.mode}
                      onChange={(event) => updateDraft(item.id, { mode: event.target.value as PriceMode })}
                      className={inputClass()}
                    >
                      <option value="fixed">₦ Amount</option>
                      <option value="percent">% Off</option>
                    </select>
                    <input
                      id={inputId}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={draft.mode === "percent" ? 100 : undefined}
                      step={draft.mode === "percent" ? "0.1" : "0.01"}
                      value={draft.value}
                      onChange={(event) => updateDraft(item.id, { value: event.target.value })}
                      placeholder={draft.mode === "percent" ? "e.g. 5" : "Standard price"}
                      className={`${inputClass()} tabular-nums`}
                    />
                  </div>
                  {draft.value.trim() !== "" && (
                    <p
                      className={`mt-2 text-sm ${
                        itemMargin !== null && itemMargin < 0 ? "text-[#C8432B]" : "text-gray-600 dark:text-[#9FB3B7]"
                      }`}
                    >
                      {result === null
                        ? priceValid
                          ? "Enter a valid value."
                          : "Enter the standard selling price to see the result."
                        : `${item.name} pays ${formatNaira(result)}${
                            itemMargin === null
                              ? "."
                              : itemMargin < 0
                                ? `, which loses you ${formatNaira(Math.abs(itemMargin))} per sale.`
                                : `, which earns you ${formatNaira(itemMargin)} per sale.`
                          }`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

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
        <Link href={back} className={`${btnGhost} inline-flex items-center`}>Cancel</Link>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : plan ? "Save plan" : "Add plan"}
        </button>
      </div>
    </form>
  );
}
