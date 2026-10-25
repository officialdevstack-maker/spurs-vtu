"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Tabs } from "@/components/admin/tabs";
import { btnIcon, btnPrimary } from "@/components/admin/modal";
import { ConfirmDialog, NameDialog } from "@/components/admin/airtime-data/dialogs";
import { Switch } from "@/components/admin/airtime-data/panels";
import { createOperator, removeOperator, renameOperator, setOperatorEnabled, removePlan, setPlanActive } from "@/app/admin/products/cable-tv/actions";
import { editCablePlanUrl, newCablePlanUrl, operatorUrl, type CableOperator } from "@/lib/admin/cable";
import { formatNaira } from "@/lib/format";

type Dialog = "add" | "rename" | "delete" | null;

export function CableTVManager({ operators: initial, initialOperator }: { operators: CableOperator[]; initialOperator?: string }) {
  const [operators, setOperators] = useState(initial);
  const [previousProps, setPreviousProps] = useState({ initial, initialOperator });
  const [operatorId, setOperatorId] = useState(
    initial.find((operator) => operator.id === initialOperator)?.id ?? initial[0]?.id ?? "",
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (previousProps.initial !== initial || previousProps.initialOperator !== initialOperator) {
    setPreviousProps({ initial, initialOperator });
    setOperators(initial);
    if (previousProps.initialOperator !== initialOperator || !initial.some((item) => item.id === operatorId)) {
      setOperatorId(initial.find((item) => item.id === initialOperator)?.id ?? initial[0]?.id ?? "");
    }
  }

  const commit = (next: CableOperator, run: () => Promise<{ ok: boolean; error?: string }>) => {
    const previous = operators;
    setError(null);
    setOperators((current) => current.map((item) => (item.id === next.id ? next : item)));
    startTransition(async () => {
      try {
        const result = await run();
        if (!result.ok) {
          setOperators(previous);
          setError(result.error ?? "Could not save changes.");
        }
      } catch (cause) {
        console.error("[cable-tv] Failed to save changes", cause);
        setOperators(previous);
        setError("Could not save changes. Please try again.");
      }
    });
  };

  const selected = operators.find((item) => item.id === operatorId) ?? operators[0];
  const tabs = operators.map((item) => ({
    id: item.id,
    label: (
      <span className="flex items-center gap-2">
        {item.name}
        {!item.enabled && (
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-[#9FB3B7]">
            Off
          </span>
        )}
      </span>
    ),
  }));

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl border border-[#C8432B] bg-white px-4 py-3 text-sm text-[#C8432B]">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => setDialog("add")} className={`${btnPrimary} inline-flex items-center gap-2`}>
          <Plus className="size-5" aria-hidden="true" />
          Add operator
        </button>
      </div>

      {!selected ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <p className="font-medium">No operators yet</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Add an operator to start managing bouquets.</p>
        </div>
      ) : (
        <Tabs label="Operator" tabs={tabs} value={selected.id} onChange={setOperatorId}>
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-100 p-4 dark:border-white/10 dark:bg-white/5 sm:px-5">
              <div className="min-w-0">
                <p className="font-medium">
                  {selected.name} is {selected.enabled ? "on" : "off"}
                </p>
                <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
                  {selected.enabled ? "Customers can buy from this operator." : "Customers can't buy from this operator."}
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button type="button" onClick={() => setDialog("rename")} aria-label={`Rename ${selected.name}`} title="Rename" className={btnIcon}>
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setDialog("delete")} aria-label={`Delete ${selected.name}`} title="Delete" className={btnIcon}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
                <Switch
                  checked={selected.enabled}
                  label={`${selected.name} enabled`}
                  onChange={(next) => commit({ ...selected, enabled: next }, () => setOperatorEnabled(selected.id, next))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Bouquets</h2>
              <Link href={newCablePlanUrl(selected.id)} className={`${btnPrimary} inline-flex items-center gap-2`}>
                <Plus className="size-5" aria-hidden="true" />
                Add bouquet
              </Link>
            </div>

            {selected.plans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
                <p className="font-medium">No bouquets yet</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Create your first plan for {selected.name}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Bouquet</th>
                      <th className="px-4 py-3 font-medium">Validity</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Cost</th>
                      <th className="px-4 py-3 font-medium">Provider</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                    {selected.plans.map((plan) => (
                      <tr key={plan.id} className="align-middle">
                        <td className="px-4 py-4 font-medium">{plan.name}</td>
                        <td className="px-4 py-4">{plan.validity}</td>
                        <td className="px-4 py-4 tabular-nums">{formatNaira(plan.price)}</td>
                        <td className="px-4 py-4 tabular-nums">{formatNaira(plan.cost)}</td>
                        <td className="px-4 py-4">{plan.providerName ?? "Any provider"}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={plan.active}
                              label={`${plan.name} active`}
                              onChange={(next) =>
                                commit(
                                  { ...selected, plans: selected.plans.map((item) => (item.id === plan.id ? { ...item, active: next } : item)) },
                                  () => setPlanActive(selected.id, plan.id, next),
                                )
                              }
                            />
                            <span className="text-xs text-gray-600 dark:text-[#9FB3B7]">{plan.active ? "On" : "Off"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={editCablePlanUrl(plan.id)} className={btnIcon} aria-label={`Edit ${plan.name}`} title="Edit">
                              <Pencil className="size-4" aria-hidden="true" />
                            </Link>
                            <button
                              type="button"
                              onClick={async () => {
                                const result = await removePlan(selected.id, plan.id);
                                if (!result.ok) {
                                  setError(result.error);
                                  return;
                                }
                                setOperators((current) =>
                                  current.map((item) =>
                                    item.id === selected.id
                                      ? { ...item, plans: item.plans.filter((currentPlan) => currentPlan.id !== plan.id) }
                                      : item,
                                  ),
                                );
                              }}
                              aria-label={`Delete ${plan.name}`}
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
          </div>
        </Tabs>
      )}

      {dialog === "add" && (
        <NameDialog
          title="Add operator"
          label="Operator name"
          submitLabel="Add operator"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const result = await createOperator(name);
            if (result.ok && result.id) {
              setOperatorId(result.id);
            }
            return result;
          }}
        />
      )}

      {dialog === "rename" && selected && (
        <NameDialog
          title={`Rename ${selected.name}`}
          label="Operator name"
          initial={selected.name}
          submitLabel="Save name"
          onClose={() => setDialog(null)}
          onSubmit={(name) => renameOperator(selected.id, name)}
        />
      )}

      {dialog === "delete" && selected && (
        <ConfirmDialog
          title={`Delete ${selected.name}?`}
          text={`This permanently removes ${selected.name} and all of its bouquets. To just stop sales, switch the operator off instead.`}
          confirmLabel="Delete operator"
          onClose={() => setDialog(null)}
          onConfirm={() => removeOperator(selected.id)}
        />
      )}
    </div>
  );
}
