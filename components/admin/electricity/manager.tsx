"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Modal, btnDanger, btnGhost, btnPrimary } from "@/components/admin/modal";
import { createDisco, removeDisco, setDiscoEnabled, updateDisco } from "@/app/admin/products/electricity/actions";
import type { ProviderOption } from "@/lib/admin/airtime-data";
import type { Disco } from "@/lib/admin/electricity";
import type { DiscoFields } from "@/lib/db/electricity";
import { formatNaira } from "@/lib/format";

const input =
  "h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]";

type Form = {
  name: string;
  providerCode: string;
  discount: string;
  providerId: string;
  providerDiscount: string;
  minAmount: string;
  maxAmount: string;
  enabled: boolean;
};

const emptyForm: Form = {
  name: "",
  providerCode: "",
  discount: "0",
  providerId: "",
  providerDiscount: "",
  minAmount: "500",
  maxAmount: "100000",
  enabled: true,
};

const toForm = (d: Disco): Form => ({
  name: d.name,
  providerCode: d.providerCode,
  discount: String(d.discount),
  providerId: d.providerId ?? "",
  providerDiscount: d.providerDiscount === null ? "" : String(d.providerDiscount),
  minAmount: String(d.minAmount),
  maxAmount: String(d.maxAmount),
  enabled: d.enabled,
});

const toFields = (f: Form): DiscoFields => ({
  name: f.name,
  providerCode: f.providerCode,
  discount: Number(f.discount),
  providerId: f.providerId || null,
  providerDiscount: f.providerDiscount.trim() === "" ? null : Number(f.providerDiscount),
  minAmount: Number(f.minAmount),
  maxAmount: Number(f.maxAmount),
  enabled: f.enabled,
});

export function ElectricityManager({ discos, providers, canManage }: { discos: Disco[]; providers: ProviderOption[]; canManage: boolean }) {
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [deleting, setDeleting] = useState<Disco | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    startTransition(async () => {
      const result = editing.id
        ? await updateDisco(editing.id, toFields(editing.form))
        : await createDisco(toFields(editing.form));
      if (!result.ok) return setError(result.error);
      toast.success(editing.id ? "Disco updated." : "Disco added.");
      setEditing(null);
    });
  }

  function toggle(disco: Disco) {
    startTransition(async () => {
      const result = await setDiscoEnabled(disco.id, !disco.enabled);
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await removeDisco(deleting.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Disco deleted.");
      setDeleting(null);
    });
  }

  const set = (patch: Partial<Form>) => setEditing((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current));

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-white/10">
        <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
          {providers.length === 0
            ? "No enabled provider has an electricity endpoint yet."
            : `${discos.length} distribution companies`}
        </p>
        {canManage && (
          <button type="button" className={btnPrimary} onClick={() => { setError(""); setEditing({ id: null, form: emptyForm }); }}>
            Add disco
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
            <tr>
              <th className="px-5 py-3">Disco</th>
              <th className="px-5 py-3">Provider</th>
              <th className="px-5 py-3">Customer discount</th>
              <th className="px-5 py-3">Provider discount</th>
              <th className="px-5 py-3">Limits</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {discos.map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-4 font-medium">{d.name}</td>
                <td className="px-5 py-4">{d.providerName ?? "Any by priority"}</td>
                <td className="px-5 py-4 tabular-nums">{d.discount}%</td>
                <td className="px-5 py-4 tabular-nums">{d.providerDiscount === null ? "—" : `${d.providerDiscount}%`}</td>
                <td className="whitespace-nowrap px-5 py-4 tabular-nums">{formatNaira(d.minAmount)} – {formatNaira(d.maxAmount)}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${d.enabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-[#9FB3B7]"}`}>
                    {d.enabled ? "On" : "Off"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      <button type="button" className={btnGhost} disabled={pending} onClick={() => toggle(d)}>{d.enabled ? "Turn off" : "Turn on"}</button>
                      <button type="button" className={btnGhost} onClick={() => { setError(""); setEditing({ id: d.id, form: toForm(d) }); }}>Edit</button>
                      <button type="button" className={btnDanger} onClick={() => setDeleting(d)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? "Edit disco" : "Add disco"} onClose={() => !pending && setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            <label className="block text-sm font-medium">
              Name
              <input className={`${input} mt-1`} value={editing.form.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} required />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Provider
                <select className={`${input} mt-1`} value={editing.form.providerId} onChange={(e) => set({ providerId: e.target.value })}>
                  <option value="">Any by priority</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Provider&apos;s code for this disco
                <input className={`${input} mt-1`} value={editing.form.providerCode} onChange={(e) => set({ providerCode: e.target.value })} maxLength={40} placeholder="ikeja-electric" />
              </label>
              <label className="block text-sm font-medium">
                Customer discount (%)
                <input className={`${input} mt-1`} type="number" min="0" max="100" step="0.01" value={editing.form.discount} onChange={(e) => set({ discount: e.target.value })} required />
              </label>
              <label className="block text-sm font-medium">
                Provider discount (%)
                <input className={`${input} mt-1`} type="number" min="0" max="100" step="0.01" value={editing.form.providerDiscount} onChange={(e) => set({ providerDiscount: e.target.value })} placeholder="Optional" />
              </label>
              <label className="block text-sm font-medium">
                Minimum (₦)
                <input className={`${input} mt-1`} type="number" min="0" step="1" value={editing.form.minAmount} onChange={(e) => set({ minAmount: e.target.value })} required />
              </label>
              <label className="block text-sm font-medium">
                Maximum (₦)
                <input className={`${input} mt-1`} type="number" min="0" step="1" value={editing.form.maxAmount} onChange={(e) => set({ maxAmount: e.target.value })} required />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={editing.form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
              Available to customers
            </label>
            {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" className={btnGhost} disabled={pending} onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete disco?" onClose={() => !pending && setDeleting(null)}>
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">Delete {deleting.name}? Customers will no longer be able to buy for it. Past transactions are kept.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={pending} onClick={() => setDeleting(null)}>Cancel</button>
            <button type="button" className={btnDanger} disabled={pending} onClick={remove}>{pending ? "Deleting..." : "Delete disco"}</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
