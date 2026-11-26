"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Modal, btnDanger, btnGhost, btnPrimary } from "@/components/admin/modal";
import {
  createDisco,
  removeDisco,
  setDiscoEnabled,
  updateDisco,
} from "@/app/admin/products/electricity/actions";
import type { PackageOption, ProviderOption } from "@/lib/admin/airtime-data";
import type { Disco } from "@/lib/admin/electricity";
import { electricityPrice } from "@/lib/electricity-purchase";
import { formatNaira, formatNumber } from "@/lib/format";

const field =
  "h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B] dark:focus-visible:ring-[#F2B632]";

const num = (value: string) => (value.trim() === "" ? NaN : Number(value));
const PREVIEW_AMOUNT = 10_000;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-600 dark:text-[#9FB3B7]">{hint}</span>}
    </label>
  );
}

function DiscoForm({
  disco,
  providers,
  packages,
  onClose,
}: {
  disco?: Disco;
  providers: ProviderOption[];
  packages: PackageOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [name, setName] = useState(disco?.name ?? "");
  const [providerId, setProviderId] = useState(disco?.providerId ?? "");
  const [providerCode, setProviderCode] = useState(disco?.providerCode ?? "");
  const [discount, setDiscount] = useState(String(disco?.discount ?? 0));
  const [providerDiscount, setProviderDiscount] = useState(
    disco?.providerDiscount === null || disco?.providerDiscount === undefined ? "" : String(disco.providerDiscount),
  );
  const [minAmount, setMinAmount] = useState(String(disco?.minAmount ?? 500));
  const [maxAmount, setMaxAmount] = useState(String(disco?.maxAmount ?? 100000));
  const [enabled, setEnabled] = useState(disco?.enabled ?? true);
  const [overrides, setOverrides] = useState<Record<string, string>>(() =>
    Object.fromEntries((disco?.packageDiscounts ?? []).map((item) => [item.packageId, String(item.discount)])),
  );

  const cost = providerDiscount.trim() === "" ? null : num(providerDiscount);
  const belowCost = (percent: number) => cost !== null && Number.isFinite(cost) && percent > cost;

  function save() {
    setError("");
    const packageDiscounts = Object.entries(overrides)
      .filter(([, value]) => value.trim() !== "")
      .map(([packageId, value]) => ({ packageId, discount: num(value) }));

    const input = {
      name,
      providerCode,
      providerId: providerId || null,
      discount: num(discount),
      providerDiscount: cost,
      minAmount: num(minAmount),
      maxAmount: num(maxAmount),
      enabled,
      packageDiscounts,
    };

    startTransition(async () => {
      const result = disco ? await updateDisco(disco.id, input) : await createDisco(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(disco ? "Disco saved." : "Disco added.");
      onClose();
      router.refresh();
    });
  }

  const standard = num(discount);

  return (
    <Modal title={disco ? `Edit ${disco.name}` : "Add disco"} onClose={() => !pending && onClose()}>
      <div className="max-h-[70dvh] space-y-5 overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={field} />
          </Field>
          <Field label="Provider" hint="Choose a provider, or leave it to pick by priority.">
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className={field}>
              <option value="">Any provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Provider code" hint="The provider's own code for this disco. Sent as {disco}.">
            <input value={providerCode} onChange={(e) => setProviderCode(e.target.value)} maxLength={40} className={field} />
          </Field>
          <Field label="Provider discount (%)" hint="What the provider gives you. Used for profit tracking.">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={100}
              value={providerDiscount}
              onChange={(e) => setProviderDiscount(e.target.value)}
              className={field}
            />
          </Field>
          <Field label="Minimum amount (₦)">
            <input type="number" min={0} value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className={field} />
          </Field>
          <Field label="Maximum amount (₦)">
            <input type="number" min={0} value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className={field} />
          </Field>
        </div>

        <section className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold">Customer discount</h3>
          <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">
            The percentage a customer gets off the amount. Leave a package empty to use the standard discount.
          </p>

          <div className="mt-4 divide-y divide-gray-200 dark:divide-white/10">
            <div className="grid grid-cols-[1fr_7rem] items-center gap-3 py-3 sm:grid-cols-[1fr_7rem_1fr]">
              <p className="text-sm font-medium">Standard</p>
              <input
                aria-label="Standard discount percent"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                max={100}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className={field}
              />
              <p className="col-span-2 text-xs text-gray-600 sm:col-span-1 dark:text-[#9FB3B7]">
                {Number.isFinite(standard) && standard >= 0 && standard <= 100
                  ? `Pays ${formatNaira(electricityPrice(PREVIEW_AMOUNT, standard))} on ${formatNaira(PREVIEW_AMOUNT)}`
                  : "Enter 0 to 100"}
                {belowCost(standard) && <span className="ml-2 font-medium text-[#C8432B]">Below your cost</span>}
              </p>
            </div>

            {packages.map((pkg) => {
              const value = overrides[pkg.id] ?? "";
              const percent = num(value);
              const valid = value.trim() !== "" && percent >= 0 && percent <= 100;
              return (
                <div key={pkg.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 py-3 sm:grid-cols-[1fr_7rem_1fr]">
                  <p className="text-sm font-medium">{pkg.name}</p>
                  <input
                    aria-label={`${pkg.name} discount percent`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    max={100}
                    placeholder="Standard"
                    value={value}
                    onChange={(e) => setOverrides((current) => ({ ...current, [pkg.id]: e.target.value }))}
                    className={field}
                  />
                  <p className="col-span-2 text-xs text-gray-600 sm:col-span-1 dark:text-[#9FB3B7]">
                    {valid
                      ? `Pays ${formatNaira(electricityPrice(PREVIEW_AMOUNT, percent))} on ${formatNaira(PREVIEW_AMOUNT)}`
                      : "Uses the standard discount"}
                    {valid && belowCost(percent) && <span className="ml-2 font-medium text-[#C8432B]">Below your cost</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4" />
          Available to customers
        </label>

        {error && (
          <p role="alert" className="text-sm text-[#C8432B]">
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className={btnGhost} disabled={pending} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={btnPrimary} disabled={pending} onClick={save}>
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

export function ElectricityManager({
  discos,
  providers,
  packages,
  canManage,
}: {
  discos: Disco[];
  providers: ProviderOption[];
  packages: PackageOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Disco | "new" | null>(null);
  const [deleting, setDeleting] = useState<Disco | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const packageName = (id: string) => packages.find((pkg) => pkg.id === id)?.name ?? id;

  function toggle(disco: Disco) {
    startTransition(async () => {
      const result = await setDiscoEnabled(disco.id, !disco.enabled);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    setDeleteError("");
    startTransition(async () => {
      const result = await removeDisco(deleting.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      toast.success(`${deleting.name} deleted.`);
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button type="button" className={`${btnPrimary} inline-flex items-center gap-2`} onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden="true" />
            Add disco
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {discos.length === 0 ? (
          <div className="p-10 text-center">
            <Zap className="mx-auto size-8 text-gray-400" aria-hidden="true" />
            <p className="mt-3 font-medium">No discos yet</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Add a distribution company to start selling electricity.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                <tr>
                  <th scope="col" className="px-5 py-3">Disco</th>
                  <th scope="col" className="px-5 py-3">Provider</th>
                  <th scope="col" className="px-5 py-3">Limits</th>
                  <th scope="col" className="px-5 py-3">Customer discount</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  {canManage && (
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {discos.map((disco) => (
                  <tr key={disco.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium">{disco.name}</p>
                      {disco.providerCode && (
                        <p className="mt-1 font-mono text-xs text-gray-600 dark:text-[#9FB3B7]">{disco.providerCode}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {disco.providerName ?? <span className="text-gray-600 dark:text-[#9FB3B7]">Any, by priority</span>}
                      {disco.providerDiscount !== null && (
                        <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">Cost: {disco.providerDiscount}% off</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      ₦{formatNumber(disco.minAmount)} – ₦{formatNumber(disco.maxAmount)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{disco.discount}% standard</p>
                      {disco.packageDiscounts.length > 0 && (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {disco.packageDiscounts.map((item) => (
                            <li
                              key={item.packageId}
                              className="rounded-md bg-gray-100 px-2 py-0.5 text-xs dark:bg-white/10"
                            >
                              {packageName(item.packageId)} {item.discount}%
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          disco.enabled
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300"
                            : "bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-[#9FB3B7]"
                        }`}
                      >
                        {disco.enabled ? "On" : "Off"}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" className={btnGhost} disabled={pending} onClick={() => toggle(disco)}>
                            {disco.enabled ? "Turn off" : "Turn on"}
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ${disco.name}`}
                            title="Edit"
                            className={btnGhost}
                            onClick={() => setEditing(disco)}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${disco.name}`}
                            title="Delete"
                            className={btnGhost}
                            onClick={() => {
                              setDeleteError("");
                              setDeleting(disco);
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <DiscoForm
          key={editing === "new" ? "new" : editing.id}
          disco={editing === "new" ? undefined : editing}
          providers={providers}
          packages={packages}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <Modal title="Delete disco?" onClose={() => !pending && setDeleting(null)}>
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            Delete {deleting.name}? Customers won&apos;t be able to buy it, and its package discounts are removed. Past
            transactions are not affected.
          </p>
          {deleteError && (
            <p role="alert" className="mt-4 text-sm text-[#C8432B]">
              {deleteError}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={pending} onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button type="button" className={btnDanger} disabled={pending} onClick={confirmDelete}>
              {pending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
