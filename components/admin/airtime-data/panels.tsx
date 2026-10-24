"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { Tabs } from "@/components/admin/tabs";
import { btnIcon, btnPrimary } from "@/components/admin/modal";
import { formatNaira } from "@/lib/format";
import {
  SERVICES,
  editDiscountUrl,
  newDiscountUrl,
  typeLabel,
  type AirtimeDiscount,
  type DataPlan,
  type DataTypeOption,
  type NetworkProduct,
  type PinStock,
} from "@/lib/admin/airtime-data";
import {
  createDataType,
  createPlan,
  removeDataType,
  removeDiscount,
  removePlan,
  renameDataType,
  setDiscountActive,
  setNetworkTypeEnabled,
  setPlanActive,
  updatePlan,
  type ActionResult,
} from "@/app/admin/products/airtime-data/actions";
import { ConfirmDialog, NameDialog, PlanDialog } from "./dialogs";
import { TypeDialog } from "./type-dialog";

/** Applies a change on screen right away, runs the server action, and rolls back if it fails. */
export type Commit = (next: NetworkProduct, run: () => Promise<ActionResult>) => void;

type PanelProps = { network: NetworkProduct; commit: Commit; types: DataTypeOption[] };

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 dark:focus-visible:ring-[#F2B632] dark:focus-visible:ring-offset-[#0B1B1F] ${
        checked ? "bg-[#1E8E4F] dark:bg-[#4CC38A]" : "bg-gray-300 dark:bg-white/20"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

/** Written state next to a switch, so it never relies on colour alone. */
function OnOff({ on }: { on: boolean }) {
  return <span className="w-7 text-sm text-gray-600 dark:text-[#9FB3B7]">{on ? "On" : "Off"}</span>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
      <Receipt className="mx-auto size-8 text-gray-400" aria-hidden="true" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">{text}</p>
    </div>
  );
}

const th = "px-3 py-3 text-left text-sm font-medium text-gray-600 dark:text-[#9FB3B7] sm:px-5";
const td = "px-3 py-4 sm:px-5";
const tableWrap = "overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10";
const tableBody = "divide-y divide-gray-200 dark:divide-white/10";

type TypeDialogState =
  | { kind: "add" }
  | { kind: "rename"; type: DataTypeOption }
  | { kind: "delete"; type: DataTypeOption }
  | null;

export function NetworkTypesPanel({ network, types, commit }: PanelProps) {
  const [dialog, setDialog] = useState<TypeDialogState>(null);
  const close = () => setDialog(null);

  return (
    <section aria-labelledby="types-heading" className="max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 id="types-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
            Network types
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
            Each type belongs to airtime or data. Choose which ones customers can buy on {network.name}. Adding, renaming
            or deleting a type applies to every network.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: "add" })}
          className={`${btnPrimary} inline-flex shrink-0 items-center gap-2`}
        >
          <Plus className="size-5" aria-hidden="true" />
          Add type
        </button>
      </div>

      {types.length === 0 ? (
        <div className="mt-4">
          <Empty title="No network types yet" text="Add a type like VTU for airtime or SME for data." />
        </div>
      ) : (
          <div className="mt-4 space-y-6">
            {SERVICES.map((service) => {
              const serviceTypes = types.filter((type) => type.service === service.id);
              return (
                <div key={service.id}>
                  <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-[#9FB3B7]">{service.label}</h4>
                  {serviceTypes.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-600 dark:border-white/15 dark:text-[#9FB3B7]">
                      No {service.label.toLowerCase()} types yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
                      {serviceTypes.map((type) => {
                        const on = network.enabledTypes.includes(type.id);
                        const isAirtime = service.id === "airtime";
                        const count = isAirtime
                          ? network.discounts.filter((discount) => discount.type === type.id).length
                          : network.plans.filter((plan) => plan.type === type.id).length;
                        const noun = isAirtime ? "discount" : "plan";
                        return (
                          <li key={type.id} className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                            <div className="min-w-0">
                              <p className="font-medium">{type.label}</p>
                              <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
                                {count} {count === 1 ? noun : `${noun}s`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                              <button
                                type="button"
                                onClick={() => setDialog({ kind: "rename", type })}
                                aria-label={`Rename ${type.label}`}
                                title="Rename"
                                className={btnIcon}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDialog({ kind: "delete", type })}
                                aria-label={`Delete ${type.label}`}
                                title="Delete"
                                className={btnIcon}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </button>
                              <OnOff on={on} />
                              <Switch
                                checked={on}
                                label={`${type.label} ${service.label.toLowerCase()} on ${network.name}`}
                                onChange={(next) =>
                                  commit(
                                    {
                                      ...network,
                                      enabledTypes: next
                                        ? [...network.enabledTypes, type.id]
                                        : network.enabledTypes.filter((item) => item !== type.id),
                                    },
                                    () => setNetworkTypeEnabled(network.id, type.id, next),
                                  )
                                }
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {dialog?.kind === "add" && (
          <TypeDialog onClose={close} onSubmit={(label, service) => createDataType(label, service)} />
      )}
      {dialog?.kind === "rename" && (
        <NameDialog
          title={`Rename ${dialog.type.label}`}
          label="Type name"
          initial={dialog.type.label}
          submitLabel="Save name"
          maxLength={20}
          onClose={close}
          onSubmit={(label) => renameDataType(dialog.type.id, label)}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title={`Delete ${dialog.type.label}?`}
          text={`${dialog.type.label} will be removed from every network. Remove or change any plans or discounts that use it first.`}
          confirmLabel="Delete type"
          onClose={close}
          onConfirm={() => removeDataType(dialog.type.id)}
        />
      )}
    </section>
  );
}

export function DiscountsPanel({ network, types, commit }: PanelProps) {
  const [deleting, setDeleting] = useState<AirtimeDiscount | null>(null);

  return (
    <section aria-labelledby="discounts-heading">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 id="discounts-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
            Airtime discounts
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
            Percentage off {network.name} airtime, set per airtime type and amount range.
          </p>
        </div>
        <Link href={newDiscountUrl(network.id)} className={`${btnPrimary} inline-flex shrink-0 items-center gap-2`}>
          <Plus className="size-5" aria-hidden="true" />
          Add discount
        </Link>
      </div>

      {network.discounts.length === 0 ? (
        <Empty title="No discounts yet" text={`Discounts you add for ${network.name} will show up here.`} />
      ) : (
        <div className={tableWrap}>
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-gray-200 dark:border-white/10">
              <tr>
                <th scope="col" className={th}>Type</th>
                <th scope="col" className={th}>Amount range</th>
                <th scope="col" className={`${th} text-right`}>Discount</th>
                <th scope="col" className={`${th} text-right`}>Active</th>
                <th scope="col" className={`${th} text-right`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className={tableBody}>
              {network.discounts.map((discount) => {
                const label = typeLabel(types, discount.type);
                return (
                  <tr key={discount.id}>
                    <td className={td}>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold dark:bg-white/10">{label}</span>
                    </td>
                    <td className={`${td} tabular-nums`}>
                      {formatNaira(discount.min)} – {formatNaira(discount.max)}
                    </td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{discount.discount}%</td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-3">
                        <OnOff on={discount.active} />
                        <Switch
                          checked={discount.active}
                          label={`${label} discount ${formatNaira(discount.min)} to ${formatNaira(discount.max)} on ${network.name}`}
                          onChange={(next) =>
                            commit(
                              {
                                ...network,
                                discounts: network.discounts.map((item) =>
                                  item.id === discount.id ? { ...item, active: next } : item,
                                ),
                              },
                              () => setDiscountActive(network.id, discount.id, next),
                            )
                          }
                        />
                      </div>
                    </td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={editDiscountUrl(discount.id)}
                          aria-label={`Edit ${label} discount`}
                          title="Edit"
                          className={btnIcon}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleting(discount)}
                          aria-label={`Delete ${label} discount`}
                          title="Delete"
                          className={btnIcon}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this discount?"
          text={`This removes the ${deleting.discount}% ${typeLabel(types, deleting.type)} discount for ${formatNaira(deleting.min)} to ${formatNaira(deleting.max)} on ${network.name}. To stop it temporarily, switch it off instead.`}
          confirmLabel="Delete discount"
          onClose={() => setDeleting(null)}
          onConfirm={() => removeDiscount(network.id, deleting.id)}
        />
      )}
    </section>
  );
}

type PlanDialogState =
  | { kind: "add" }
  | { kind: "edit"; plan: DataPlan }
  | { kind: "delete"; plan: DataPlan }
  | null;

export function DataPlansPanel({ network, types: allTypes, commit }: PanelProps) {
  const types = allTypes.filter((type) => type.service === "data");
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState<PlanDialogState>(null);
  const close = () => setDialog(null);
  const activeFilter = filter === "all" || types.some((type) => type.id === filter) ? filter : "all";
  const visible = activeFilter === "all" ? network.plans : network.plans.filter((plan) => plan.type === activeFilter);

  const tabs = [
    { id: "all", label: `All (${network.plans.length})` },
    ...types.map((type) => ({
      id: type.id,
      label: `${type.label} (${network.plans.filter((plan) => plan.type === type.id).length})`,
    })),
  ];

  return (
    <section aria-labelledby="plans-heading">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 id="plans-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
            Data plans
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Turn a plan off to hide it from customers.</p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: "add" })}
          disabled={types.length === 0}
          className={`${btnPrimary} inline-flex shrink-0 items-center gap-2`}
        >
          <Plus className="size-5" aria-hidden="true" />
          Add plan
        </button>
      </div>
      {types.length === 0 && (
        <p className="mb-4 text-sm text-gray-600 dark:text-[#9FB3B7]">
          Add a network type first, then you can create plans.
        </p>
      )}

      <Tabs label="Filter plans by network type" tabs={tabs} value={activeFilter} onChange={setFilter} variant="pill">
        {visible.length === 0 ? (
          <Empty
            title="No plans here"
            text={`There are no ${activeFilter === "all" ? "" : `${typeLabel(types, activeFilter)} `}plans yet.`}
          />
        ) : (
          <div className={tableWrap}>
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th scope="col" className={th}>Plan</th>
                  <th scope="col" className={th}>Type</th>
                  <th scope="col" className={`${th} text-right`}>Cost</th>
                  <th scope="col" className={`${th} text-right`}>Price</th>
                  <th scope="col" className={`${th} text-right`}>Active</th>
                  <th scope="col" className={`${th} text-right`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className={tableBody}>
                {visible.map((plan) => (
                  <tr key={plan.id}>
                    <td className={td}>
                      <p className="font-medium">{plan.size}</p>
                      <p className="text-gray-600 dark:text-[#9FB3B7]">{plan.validity}</p>
                    </td>
                    <td className={td}>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold dark:bg-white/10">
                        {typeLabel(types, plan.type)}
                      </span>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{formatNaira(plan.cost)}</td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{formatNaira(plan.price)}</td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-3">
                        <OnOff on={plan.active} />
                        <Switch
                          checked={plan.active}
                          label={`${plan.size} ${typeLabel(types, plan.type)} plan on ${network.name}`}
                          onChange={(next) =>
                            commit(
                              {
                                ...network,
                                plans: network.plans.map((item) =>
                                  item.id === plan.id ? { ...item, active: next } : item,
                                ),
                              },
                              () => setPlanActive(network.id, plan.id, next),
                            )
                          }
                        />
                      </div>
                    </td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: "edit", plan })}
                          aria-label={`Edit ${plan.size} ${typeLabel(types, plan.type)} plan`}
                          title="Edit"
                          className={btnIcon}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: "delete", plan })}
                          aria-label={`Delete ${plan.size} ${typeLabel(types, plan.type)} plan`}
                          title="Delete"
                          className={btnIcon}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tabs>

      {dialog?.kind === "add" && (
        <PlanDialog
          networkName={network.name}
          types={types}
          defaultType={activeFilter === "all" ? undefined : activeFilter}
          onClose={close}
          onSubmit={(input) => createPlan(network.id, input)}
        />
      )}
      {dialog?.kind === "edit" && (
        <PlanDialog
          networkName={network.name}
          types={types}
          plan={dialog.plan}
          onClose={close}
          onSubmit={(input) => updatePlan(network.id, dialog.plan.id, input)}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title={`Delete ${dialog.plan.size} plan?`}
          text={`This removes the ${dialog.plan.size} ${typeLabel(types, dialog.plan.type)} plan from ${network.name}. To hide it temporarily, switch it off instead.`}
          confirmLabel="Delete plan"
          onClose={close}
          onConfirm={() => removePlan(network.id, dialog.plan.id)}
        />
      )}
    </section>
  );
}

const LOW_STOCK = 10;

export function PinsPanel({ kind, network }: { kind: "airtime" | "data"; network: NetworkProduct }) {
  const pins: PinStock[] = kind === "airtime" ? network.airtimePins : network.dataPins;
  const title = kind === "airtime" ? "Airtime pins" : "Data pins";

  return (
    <section aria-labelledby={`${kind}-pins-heading`}>
      <h3 id={`${kind}-pins-heading`} className="font-[family-name:var(--font-display)] text-lg font-bold">
        {title}
      </h3>
      <p className="mt-1 mb-4 text-sm text-gray-600 dark:text-[#9FB3B7]">
        Pin stock for {network.name}. Stock below {LOW_STOCK} is marked low.
      </p>

      {pins.length === 0 ? (
        <Empty title={`No ${title.toLowerCase()} yet`} text={`${title} you add for ${network.name} will show up here.`} />
      ) : (
        <div className={tableWrap}>
          <table className="w-full min-w-[30rem] text-sm">
            <thead className="border-b border-gray-200 dark:border-white/10">
              <tr>
                <th scope="col" className={th}>Pin</th>
                <th scope="col" className={`${th} text-right`}>Price</th>
                <th scope="col" className={`${th} text-right`}>Available</th>
                <th scope="col" className={`${th} text-right`}>Used</th>
              </tr>
            </thead>
            <tbody className={tableBody}>
              {pins.map((p) => {
                const low = p.available < LOW_STOCK;
                return (
                  <tr key={p.id}>
                    <td className={`${td} font-medium`}>{p.label}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatNaira(p.price)}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      <span className="inline-flex items-center justify-end gap-1.5">
                        {low && (
                          <>
                            <span aria-hidden="true" className="size-2 rounded-full bg-[#C8432B]" />
                            <span className="text-[#C8432B]">Low</span>
                          </>
                        )}
                        <span className="font-medium">{p.available}</span>
                      </span>
                    </td>
                    <td className={`${td} text-right tabular-nums text-gray-600 dark:text-[#9FB3B7]`}>{p.used}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
