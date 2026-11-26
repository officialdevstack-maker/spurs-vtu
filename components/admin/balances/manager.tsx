"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import { formatNaira, formatWhen } from "@/lib/format";
import type { BalanceRow } from "@/lib/db/balances";
import { checkNow, saveThreshold } from "@/app/admin/gateways/balances/actions";

type Item = BalanceRow & { monitored: boolean };

const stateStyle: Record<BalanceRow["state"], string> = {
  unknown: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-[#C6D3D5]",
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  low: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  error: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

function StateBadge({ item }: { item: Item }) {
  if (!item.monitored) {
    return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-[#C6D3D5]">Not monitored</span>;
  }
  const labels = { unknown: "Unknown", ok: "OK", low: "Low", error: "Failing" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateStyle[item.state]}`}>{labels[item.state]}</span>;
}

export function BalanceManager({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checking, setChecking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          setMessage(result.message);
          router.refresh();
        } else setError(result.error);
      } catch (cause) {
        console.error("[balances]", cause);
        setError("Could not complete that action. Try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {message && <p className="rounded-xl border border-emerald-300 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-[#C8432B] px-4 py-3 text-sm text-[#C8432B]">{error}</p>}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <p className="font-medium">No providers yet</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Add a provider to start monitoring its balance.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
          {items.map((item) => (
            <BalanceRowView
              key={item.providerId}
              item={item}
              disabled={pending}
              checking={checking === item.providerId}
              onCheck={() => {
                setChecking(item.providerId);
                run(async () => {
                  const result = await checkNow(item.providerId);
                  setChecking(null);
                  return result;
                });
              }}
              onSave={(value) => run(() => saveThreshold(item.providerId, value))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BalanceRowView({
  item, disabled, checking, onCheck, onSave,
}: {
  item: Item;
  disabled: boolean;
  checking: boolean;
  onCheck: () => void;
  onSave: (value: unknown) => void;
}) {
  const [threshold, setThreshold] = useState(item.threshold?.toString() ?? "");

  return (
    <article className="grid gap-4 border-b border-gray-200 p-4 last:border-b-0 dark:border-white/10 sm:p-5 lg:grid-cols-[1fr_160px_160px_220px] lg:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate font-semibold">{item.providerName}</h2>
          <StateBadge item={item} />
        </div>
        {!item.monitored ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-[#9FB3B7]">
            Add a Balance check endpoint to this provider.{" "}
            <a className="font-medium underline" href={`/admin/gateways/providers?provider=${encodeURIComponent(item.providerId)}`}>Open provider</a>
          </p>
        ) : item.checkedAt ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-[#9FB3B7]">Checked {formatWhen(item.checkedAt)}</p>
        ) : (
          <p className="mt-2 text-sm text-gray-600 dark:text-[#9FB3B7]">Not checked yet</p>
        )}
        {item.state === "error" && item.lastError && (
          <p className="mt-1 text-sm text-[#C8432B]">{item.lastError}</p>
        )}
      </div>
      <div>
        <p className="text-xs text-gray-600 dark:text-[#9FB3B7]">Balance</p>
        <p className="mt-1 text-lg font-semibold">{item.balance === null ? "—" : formatNaira(item.balance)}</p>
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(threshold.trim() === "" ? null : threshold);
        }}
      >
        <label className="min-w-0 flex-1 text-xs text-gray-600 dark:text-[#9FB3B7]">
          Threshold
          <input
            className={`${inputClass()} mt-1 h-10 px-3 text-sm`}
            type="number"
            min="0"
            max="100000000"
            step="0.01"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            placeholder="No alert"
          />
        </label>
        <button type="submit" className={`${btnGhost} h-10 px-3 text-sm`} disabled={disabled}>Save</button>
      </form>
      <button
        type="button"
        className={`${item.monitored ? btnPrimary : btnGhost} h-10 px-4 text-sm`}
        disabled={disabled || !item.monitored}
        onClick={onCheck}
      >
        {checking ? "Checking…" : "Check now"}
      </button>
    </article>
  );
}
