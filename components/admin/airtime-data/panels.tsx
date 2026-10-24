"use client";

import { useId, useState, type FormEvent } from "react";
import { Receipt } from "lucide-react";
import { Tabs } from "@/components/admin/tabs";
import { formatNaira } from "@/lib/format";
import { DATA_TYPES, typeLabel, type NetworkProduct, type PinStock } from "@/lib/admin/airtime-data";
import {
  saveAirtimeDiscount,
  setNetworkTypeEnabled,
  setPlanActive,
  type ActionResult,
} from "@/app/admin/products/airtime-data/actions";

/** Applies a change on screen right away, runs the server action, and rolls back if it fails. */
export type Commit = (next: NetworkProduct, run: () => Promise<ActionResult>) => void;

type PanelProps = { network: NetworkProduct; commit: Commit };

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

export function NetworkTypesPanel({ network, commit }: PanelProps) {
  return (
    <section aria-labelledby="types-heading" className="max-w-xl">
      <h3 id="types-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
        Network types
      </h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
        Choose which types customers can buy on {network.name}.
      </p>

      <ul className="mt-4 divide-y divide-gray-200 rounded-2xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
        {DATA_TYPES.map((type) => {
          const on = network.enabledTypes.includes(type.id);
          const planCount = network.plans.filter((p) => p.type === type.id).length;
          return (
            <li key={type.id} className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="font-medium">{type.label}</p>
                <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
                  {planCount} {planCount === 1 ? "plan" : "plans"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <OnOff on={on} />
                <Switch
                  checked={on}
                  label={`${type.label} on ${network.name}`}
                  onChange={(next) =>
                    commit(
                      {
                        ...network,
                        enabledTypes: next
                          ? [...network.enabledTypes, type.id]
                          : network.enabledTypes.filter((t) => t !== type.id),
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
    </section>
  );
}

export function AirtimeDiscountPanel({ network, commit }: PanelProps) {
  const id = useId();
  const [draft, setDraft] = useState(String(network.airtimeDiscount));

  const value = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 100;
  const unchanged = valid && value === network.airtimeDiscount;
  const example = valid ? 1000 * (1 - value / 100) : null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid || unchanged) return;
    commit({ ...network, airtimeDiscount: value }, () => saveAirtimeDiscount(network.id, value));
  }

  return (
    <section aria-labelledby="discount-heading" className="max-w-md">
      <h3 id="discount-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
        Airtime discount
      </h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
        Percentage taken off {network.name} airtime for customers.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
        <div>
          <label htmlFor={id} className="mb-2 block text-sm font-medium">
            Discount (%)
          </label>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!valid}
            aria-describedby={`${id}-hint`}
            className={`h-12 w-full rounded-xl border bg-white px-4 text-base tabular-nums text-[#12343B] outline-none transition-colors focus-visible:border-[#12343B] focus-visible:ring-2 focus-visible:ring-[#12343B]/25 ${
              valid ? "border-[#BFCFD2]" : "border-[#C8432B]"
            }`}
          />
          <p
            id={`${id}-hint`}
            role={valid ? undefined : "alert"}
            className={`mt-2 text-sm ${valid ? "text-gray-600 dark:text-[#9FB3B7]" : "text-[#C8432B]"}`}
          >
            {valid && example !== null
              ? `On ₦1,000 airtime, the customer pays ${formatNaira(example)}.`
              : "Enter a number from 0 to 100."}
          </p>
        </div>

        <button
          type="submit"
          disabled={!valid || unchanged}
          className="h-11 rounded-xl bg-[#F2B632] px-5 text-base font-semibold text-[#12343B] outline-none transition-colors hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-[#F2B632] dark:focus-visible:ring-offset-[#0B1B1F]"
        >
          Save discount
        </button>
      </form>
    </section>
  );
}

export function DataPlansPanel({ network, commit }: PanelProps) {
  const [filter, setFilter] = useState("all");
  const visible = filter === "all" ? network.plans : network.plans.filter((p) => p.type === filter);

  const tabs = [
    { id: "all", label: `All (${network.plans.length})` },
    ...DATA_TYPES.map((t) => ({
      id: t.id,
      label: `${t.label} (${network.plans.filter((p) => p.type === t.id).length})`,
    })),
  ];

  return (
    <section aria-labelledby="plans-heading">
      <h3 id="plans-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
        Data plans
      </h3>
      <p className="mt-1 mb-4 text-sm text-gray-600 dark:text-[#9FB3B7]">
        Turn a plan off to hide it from customers.
      </p>

      <Tabs label="Filter plans by network type" tabs={tabs} value={filter} onChange={setFilter} variant="pill">
        {visible.length === 0 ? (
          <Empty title="No plans here" text={`There are no ${filter === "all" ? "" : `${typeLabel(filter as never)} `}plans yet.`} />
        ) : (
          <div className={tableWrap}>
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th scope="col" className={th}>Plan</th>
                  <th scope="col" className={th}>Type</th>
                  <th scope="col" className={`${th} text-right`}>Cost</th>
                  <th scope="col" className={`${th} text-right`}>Price</th>
                  <th scope="col" className={`${th} text-right`}>Active</th>
                </tr>
              </thead>
              <tbody className={tableBody}>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td className={td}>
                      <p className="font-medium">{p.size}</p>
                      <p className="text-gray-600 dark:text-[#9FB3B7]">{p.validity}</p>
                    </td>
                    <td className={td}>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold dark:bg-white/10">
                        {typeLabel(p.type)}
                      </span>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{formatNaira(p.cost)}</td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{formatNaira(p.price)}</td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-3">
                        <OnOff on={p.active} />
                        <Switch
                          checked={p.active}
                          label={`${p.size} ${typeLabel(p.type)} plan on ${network.name}`}
                          onChange={(next) =>
                            commit(
                              { ...network, plans: network.plans.map((x) => (x.id === p.id ? { ...x, active: next } : x)) },
                              () => setPlanActive(network.id, p.id, next),
                            )
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tabs>
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
