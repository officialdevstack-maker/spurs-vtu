"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal, btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import { formatNaira, formatWhen } from "@/lib/format";
import {
  FRAUD_ACTIONS, RULE_META,
  type FraudAction, type FraudRule, type FraudRuleId, type FlagItem,
} from "@/lib/admin/fraud";
import { reviewFraudFlag, saveFraudRule } from "@/app/admin/users/fraud/actions";

function detailLine(item: FlagItem): string {
  const d = item.detail;
  if (item.rule === "velocity") return `${d.count} purchases in ${d.minutes} min (limit ${d.limit})`;
  if (item.rule === "repeated_failures") return `${d.count} failures in ${d.minutes} min (limit ${d.limit})`;
  if (item.rule === "shared_phone") return `${d.accounts} accounts use this phone (limit ${d.limit})`;
  if (item.rule === "abnormal_amount" && typeof d.cap === "number") {
    return `${formatNaira(Number(d.price))} exceeds the ${formatNaira(Number(d.cap))} cap`;
  }
  if (item.rule === "abnormal_amount") {
    return `${formatNaira(Number(d.price))} exceeds ${d.multiple}× the customer's average`;
  }
  return "Review required";
}

function RuleCard({ rule, disabled }: { rule: FraudRule; disabled: boolean }) {
  const router = useRouter();
  const meta = RULE_META[rule.rule];
  const [enabled, setEnabled] = useState(rule.enabled);
  const [action, setAction] = useState<FraudAction>(rule.action);
  const [params, setParams] = useState<Record<string, string>>(
    Object.fromEntries(meta.fields.map((field) => [field.key, String(rule.params[field.key] ?? "")])),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function save() {
    setError("");
    setSaved(false);
    const parsed: Record<string, number> = {};
    for (const field of meta.fields) {
      parsed[field.key] = Number(params[field.key]);
    }
    startTransition(async () => {
      try {
        const result = await saveFraudRule({ rule: rule.rule, enabled, action, params: parsed });
        if (!result.ok) setError(result.error);
        else {
          setSaved(true);
          router.refresh();
        }
      } catch {
        setError("Could not save this rule. Please try again.");
      }
    });
  }

  return (
    <article className="rounded-2xl border border-gray-200 p-5 dark:border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{meta.label}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">{meta.hint}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled || pending}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 accent-[#12343B]"
          />
          Enabled
        </label>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_220px_auto] lg:items-end">
        {meta.fields.map((field) => (
          <label key={field.key} className="text-sm font-medium">
            {field.label}
            <input
              type="number"
              min={field.min}
              max={field.max}
              value={params[field.key] ?? ""}
              disabled={disabled || pending}
              onChange={(event) => setParams((current) => ({ ...current, [field.key]: event.target.value }))}
              className={`${inputClass()} mt-2`}
            />
          </label>
        ))}
        <label className="text-sm font-medium">
          Action
          <select
            value={action}
            disabled={disabled || pending}
            onChange={(event) => setAction(event.target.value as FraudAction)}
            className={`${inputClass()} mt-2`}
          >
            {FRAUD_ACTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <button type="button" className={`${btnPrimary} whitespace-nowrap`} disabled={disabled || pending} onClick={save}>
          {pending ? "Saving..." : "Save rule"}
        </button>
      </div>
      {enabled ? (
        <p className="mt-3 text-xs text-gray-600 dark:text-[#9FB3B7]">
          {FRAUD_ACTIONS.find((item) => item.id === action)?.hint}
        </p>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm text-[#C8432B]">{error}</p> : null}
      {saved ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">Rule saved.</p> : null}
    </article>
  );
}

function ReviewModal({
  item,
  resolution,
  onClose,
}: {
  item: FlagItem;
  resolution: "dismissed" | "confirmed";
  onClose: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [suspend, setSuspend] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmed = resolution === "confirmed";

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const result = await reviewFraudFlag(item.id, resolution, note, confirmed && suspend);
        if (!result.ok) setError(result.error);
        else {
          onClose();
          router.refresh();
        }
      } catch {
        setError("Could not review this flag. Please try again.");
      }
    });
  }

  return (
    <Modal title={confirmed ? "Confirm fraud flag?" : "Dismiss fraud flag?"} onClose={() => !pending && onClose()}>
      <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
        {item.customer} · {RULE_META[item.rule].label}
      </p>
      <label className="mt-4 block text-sm font-medium">
        Review note
        <textarea
          value={note}
          minLength={3}
          maxLength={200}
          disabled={pending}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Explain the decision"
          className={`${inputClass()} mt-2 h-24 resize-none py-3`}
        />
      </label>
      {confirmed ? (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={suspend} disabled={pending} onChange={(event) => setSuspend(event.target.checked)} className="size-4 accent-[#C8432B]" />
          Also suspend this customer
        </label>
      ) : null}
      {error ? <p role="alert" className="mt-4 text-sm text-[#C8432B]">{error}</p> : null}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className={btnGhost} disabled={pending} onClick={onClose}>Cancel</button>
        <button type="button" className={confirmed ? btnDanger : btnPrimary} disabled={pending || note.trim().length < 3} onClick={submit}>
          {pending ? "Saving..." : confirmed ? "Confirm" : "Dismiss"}
        </button>
      </div>
    </Modal>
  );
}

export function FraudManager({
  rules,
  flags,
  canManageRules,
  canManageCustomers,
}: {
  rules: FraudRule[];
  flags: FlagItem[];
  canManageRules: boolean;
  canManageCustomers: boolean;
}) {
  const [dialog, setDialog] = useState<{ item: FlagItem; resolution: "dismissed" | "confirmed" } | null>(null);

  return (
    <div className="space-y-8">
      {canManageRules ? (
        <section className="space-y-4" aria-labelledby="fraud-rules-heading">
          <h2 id="fraud-rules-heading" className="text-lg font-semibold">Rules</h2>
          {rules.map((rule) => (
            <RuleCard key={rule.rule} rule={rule} disabled={false} />
          ))}
        </section>
      ) : null}

      <section aria-labelledby="fraud-flags-heading">
        <h2 id="fraud-flags-heading" className="text-lg font-semibold">Open flags</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10">
          {flags.length === 0 ? (
            <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">No open flags.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                  <tr>
                    <th scope="col" className="px-5 py-3">Customer</th>
                    <th scope="col" className="px-5 py-3">Rule</th>
                    <th scope="col" className="px-5 py-3">Action</th>
                    <th scope="col" className="px-5 py-3">Detail</th>
                    <th scope="col" className="px-5 py-3">When</th>
                    {canManageCustomers ? <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {flags.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4 font-medium">{item.customer}</td>
                      <td className="px-5 py-4">{RULE_META[item.rule].label}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.action === "hold"
                            ? "bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-300"
                            : item.action === "block"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300"
                              : "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-[#C6D3D5]"
                        }`}>
                          {item.action}
                        </span>
                      </td>
                      <td className="px-5 py-4">{detailLine(item)}</td>
                      <td className="px-5 py-4 whitespace-nowrap">{formatWhen(item.at)}</td>
                      {canManageCustomers ? (
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button type="button" className={btnGhost} onClick={() => setDialog({ item, resolution: "dismissed" })}>Dismiss</button>
                            <button type="button" className={btnDanger} onClick={() => setDialog({ item, resolution: "confirmed" })}>Confirm</button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      {dialog ? (
        <ReviewModal item={dialog.item} resolution={dialog.resolution} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}
