"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import { Switch } from "@/components/admin/airtime-data/panels";
import { resolvePackagePrice, type PackageOption, type PackagePrice, type PriceMode, type ProviderOption } from "@/lib/admin/airtime-data";
import { operatorUrl } from "@/lib/admin/cable";
import { formatNaira } from "@/lib/format";
import { createPlan, updatePlan } from "@/app/admin/products/cable-tv/actions";
import type { CablePlan } from "@/lib/admin/cable";

type Errors = Partial<Record<"name" | "validity" | "providerPlanId" | "cost" | "price" | "packagePrices" | "form", string>>;
type PackageDraft = { mode: PriceMode; value: string };
const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

export function PlanForm({
  operator,
  providers,
  packages,
  plan,
}: {
  operator: { id: string; name: string };
  providers: ProviderOption[];
  packages: PackageOption[];
  plan?: CablePlan;
}) {
  const router = useRouter();
  const base = useId();
  const back = operatorUrl(operator.id);
  const [name, setName] = useState(plan?.name ?? "");
  const [validity, setValidity] = useState(plan?.validity ?? "");
  const [providerId, setProviderId] = useState(plan?.providerId ?? "");
  const [providerPlanId, setProviderPlanId] = useState(plan?.providerPlanId ?? "");
  const [cost, setCost] = useState(plan ? String(plan.cost) : "");
  const [price, setPrice] = useState(plan ? String(plan.price) : "");
  const [packageDrafts, setPackageDrafts] = useState<Record<string, PackageDraft>>(() =>
    Object.fromEntries(
      packages.map((item) => {
        const saved = plan?.packagePrices.find((entry) => entry.packageId === item.id);
        return [item.id, { mode: saved?.mode ?? "fixed", value: saved ? String(saved.value) : "" }];
      }),
    ),
  );
  const [active, setActive] = useState(plan?.active ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  const costValue = toNumber(cost);
  const priceValue = toNumber(price);
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
    if (!name.trim()) nextErrors.name = "Enter a bouquet name.";
    if (!validity.trim()) nextErrors.validity = "Enter how long this bouquet lasts, like 1 month.";
    if (providerId && !providerPlanId.trim()) nextErrors.providerPlanId = "Enter the provider bouquet ID.";
    if (!Number.isFinite(costValue) || costValue < 0) nextErrors.cost = "Enter the provider cost, 0 or more.";
    if (!Number.isFinite(priceValue) || priceValue < 0) nextErrors.price = "Enter the selling price, 0 or more.";

    const packagePrices: PackagePrice[] = [];
    for (const item of packages) {
      const draft = packageDrafts[item.id];
      if (!draft || draft.value.trim() === "") continue;
      const value = toNumber(draft.value);
      const tooHigh = draft.mode === "percent" && value > 100;
      if (!Number.isFinite(value) || value < 0 || tooHigh) {
        nextErrors.packagePrices = `${item.name}: enter ${draft.mode === "percent" ? "a percentage from 0 to 100" : "an amount, 0 or more"}, or leave it blank.`;
        break;
      }
      packagePrices.push({ packageId: item.id, mode: draft.mode, value });
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      name: name.trim(),
      validity: validity.trim(),
      cost: costValue,
      price: priceValue,
      packagePrices,
      providerId: providerId || null,
      providerPlanId: providerPlanId.trim(),
      active,
    };

    startTransition(async () => {
      try {
        const result = plan ? await updatePlan(operator.id, plan.id, input) : await createPlan(operator.id, input);
        if (result.ok) {
          toast.success(plan ? "Bouquet updated" : "Bouquet created");
          router.push(back);
        } else {
          setErrors({ form: result.error });
        }
      } catch (error) {
        console.error("[cable-tv] Failed to save bouquet", error);
        setErrors({ form: "Could not save the bouquet. Please try again." });
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-5 rounded-2xl border border-gray-200 bg-gray-100 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6">
      {errors.form && <FormError>{errors.form}</FormError>}

      <div>
        <p className="mb-2 text-sm font-medium">Operator</p>
        <p className="flex h-12 items-center rounded-xl border border-gray-200 bg-white/60 px-4 text-base text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-[#9FB3B7]">
          {operator.name}
        </p>
      </div>

      <Field id={`${base}-name`} label="Bouquet name" error={errors.name}>
        <input
          id={`${base}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          autoFocus
          aria-invalid={!!errors.name}
          className={inputClass(!!errors.name)}
        />
      </Field>

      <Field id={`${base}-validity`} label="Validity" hint="How long the bouquet lasts." error={errors.validity}>
        <input
          id={`${base}-validity`}
          value={validity}
          onChange={(event) => setValidity(event.target.value)}
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
              ? "No provider has an active cable endpoint yet. Add one under Gateways > Providers."
              : "Purchases of this bouquet go to this provider. Leave blank to use provider priority."
          }
        >
          <select id={`${base}-provider`} value={providerId} onChange={(event) => setProviderId(event.target.value)} className={inputClass()}>
            <option value="">Any provider (by priority)</option>
            {providers.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </Field>

        <Field id={`${base}-provider-plan`} label="Provider bouquet ID" hint="The provider's own ID for this bouquet." error={errors.providerPlanId}>
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
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${base}-cost`} label="Provider cost (₦)" error={errors.cost}>
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

        <Field id={`${base}-price`} label="Selling price (₦)" error={errors.price}>
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
      </div>

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
          <p role="alert" className="text-sm text-[#C8432B]">{errors.packagePrices}</p>
        ) : (
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            Set package-specific selling prices, or leave them blank to use the standard price.
          </p>
        )}

        {packages.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">No packages yet.</p>
        ) : (
          <ul className="space-y-4">
            {packages.map((item) => {
              const draft = packageDrafts[item.id] ?? { mode: "fixed" as PriceMode, value: "" };
              const value = toNumber(draft.value);
              const valueOk = Number.isFinite(value) && value >= 0 && (draft.mode === "fixed" || value <= 100);
              const result = valueOk && priceValid ? resolvePackagePrice(priceValue, draft.mode, value) : null;
              const itemMargin = result !== null && Number.isFinite(costValue) ? result - costValue : null;
              const inputId = `${base}-package-${item.id}`;

              return (
                <li key={item.id}>
                  <label htmlFor={inputId} className="mb-2 block text-sm font-medium">{item.name}</label>
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
                      className={`mt-2 text-sm ${itemMargin !== null && itemMargin < 0 ? "text-[#C8432B]" : "text-gray-600 dark:text-[#9FB3B7]"}`}
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
        <Switch checked={active} label={`${name || "Bouquet"} active`} onChange={setActive} />
        <span>Show this bouquet to customers</span>
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <Link href={back} className={`${btnGhost} inline-flex items-center`}>
          Cancel
        </Link>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : plan ? "Save bouquet" : "Add bouquet"}
        </button>
      </div>
    </form>
  );
}
