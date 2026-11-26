"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCashback } from "@/app/admin/products/cashback/actions";
import { CASHBACK_SERVICES, MAX_CASHBACK_PERCENT, type CashbackRule, type CashbackSettings } from "@/lib/admin/cashback";

const input =
  "h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:opacity-60 dark:border-white/15 dark:bg-[#10262B]";

export function CashbackManager({ settings, canManage }: { settings: CashbackSettings; canManage: boolean }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [rules, setRules] = useState(settings.rules);
  const [pending, startTransition] = useTransition();
  const update = (service: CashbackRule["service"], patch: Partial<CashbackRule>) =>
    setRules((list) => list.map((r) => (r.service === service ? { ...r, ...patch } : r)));

  function save() {
    startTransition(async () => {
      const result = await saveCashback({ enabled, rules });
      if (result.ok) toast.success("Cashback settings saved.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <input type="checkbox" checked={enabled} disabled={!canManage} onChange={(e) => setEnabled(e.target.checked)} className="mt-1 size-4" />
        <span>
          <span className="block font-semibold">Cashback is {enabled ? "on" : "off"}</span>
          <span className="block text-sm text-gray-600 dark:text-[#9FB3B7]">Master switch. Existing balances can still be spent when it is off.</span>
        </span>
      </label>
      <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
            <tr><th className="px-5 py-3">Service</th><th className="px-5 py-3">On</th><th className="px-5 py-3">Cashback % (max {MAX_CASHBACK_PERCENT})</th><th className="px-5 py-3">Min spend (₦)</th><th className="px-5 py-3">Monthly cap per customer (₦)</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {rules.map((rule) => {
              const label = CASHBACK_SERVICES.find((s) => s.id === rule.service)?.label;
              return (
                <tr key={rule.service}>
                  <th scope="row" className="px-5 py-4 font-medium">{label}</th>
                  <td className="px-5 py-4"><input type="checkbox" aria-label={`Cashback on ${label}`} checked={rule.enabled} disabled={!canManage} onChange={(e) => update(rule.service, { enabled: e.target.checked })} className="size-4" /></td>
                  <td className="px-5 py-4"><input className={input} type="number" min={0} max={MAX_CASHBACK_PERCENT} step="0.1" aria-label={`${label} cashback percent`} value={rule.percent} disabled={!canManage} onChange={(e) => update(rule.service, { percent: Number(e.target.value) })} /></td>
                  <td className="px-5 py-4"><input className={input} type="number" min={0} aria-label={`${label} minimum spend`} value={rule.minSpend} disabled={!canManage} onChange={(e) => update(rule.service, { minSpend: Number(e.target.value) })} /></td>
                  <td className="px-5 py-4"><input className={input} type="number" min={0} placeholder="No cap" aria-label={`${label} monthly cap`} value={rule.monthlyCap ?? ""} disabled={!canManage} onChange={(e) => update(rule.service, { monthlyCap: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {canManage && <button type="button" onClick={save} disabled={pending} className="h-11 rounded-xl bg-[#F2B632] px-6 text-sm font-semibold text-[#12343B] outline-none hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:opacity-60">{pending ? "Saving…" : "Save changes"}</button>}
    </div>
  );
}
