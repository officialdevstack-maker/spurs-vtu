"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Modal, btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import { PROMO_SERVICES, type Promo, type PromoKind, type PromoService } from "@/lib/admin/promotions";
import { formatNaira, formatWhen } from "@/lib/format";
import { createPromo, removePromo, setPromoActive, updatePromo, type PromoActionResult } from "./actions";

type Draft = {
  code: string; description: string; kind: PromoKind; value: string; maxDiscount: string; minSpend: string;
  services: PromoService[]; totalLimit: string; perCustomerLimit: string; startsAt: string; expiresAt: string; active: boolean;
};
const EMPTY: Draft = {
  code: "", description: "", kind: "percent", value: "", maxDiscount: "", minSpend: "0",
  services: [], totalLimit: "", perCustomerLimit: "1", startsAt: "", expiresAt: "", active: true,
};
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const opt = (v: string) => (v.trim() === "" ? null : Number(v));
const toDraft = (p: Promo): Draft => ({
  code: p.code, description: p.description, kind: p.kind, value: String(p.value),
  maxDiscount: p.maxDiscount === null ? "" : String(p.maxDiscount), minSpend: String(p.minSpend),
  services: p.services, totalLimit: p.totalLimit === null ? "" : String(p.totalLimit),
  perCustomerLimit: String(p.perCustomerLimit), startsAt: toLocal(p.startsAt), expiresAt: toLocal(p.expiresAt), active: p.active,
});
const toInput = (d: Draft) => ({
  code: d.code, description: d.description, kind: d.kind, value: Number(d.value), maxDiscount: opt(d.maxDiscount),
  minSpend: Number(d.minSpend || 0), services: d.services, totalLimit: opt(d.totalLimit),
  perCustomerLimit: Number(d.perCustomerLimit || 1),
  startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : null,
  expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
  active: d.active,
});

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>{children}
      {hint && <span className="mt-1 block text-xs text-gray-600 dark:text-[#9FB3B7]">{hint}</span>}
    </label>
  );
}

export function PromotionsManager({ promos, canManage }: { promos: Promo[]; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [deleting, setDeleting] = useState<Promo | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<PromoActionResult>, done: () => void) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) return setError(result.error);
        done();
        router.refresh();
      } catch {
        setError("Could not complete that. Please try again.");
      }
    });
  }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, [key]: value } } : e));
  const close = () => {
    if (pending) return;
    setEditing(null);
    setDeleting(null);
    setError("");
  };

  return (
    <>
      {canManage && <div className="flex justify-end"><button type="button" className={btnPrimary} onClick={() => setEditing({ id: null, draft: EMPTY })}>New code</button></div>}
      {error && !editing && !deleting && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {promos.length === 0 ? (
          <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">No promo codes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                <tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Offer</th><th className="px-5 py-3">Used</th><th className="px-5 py-3">Runs</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {promos.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-5 py-3"><p className="font-mono font-semibold">{p.code}</p>{p.description && <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">{p.description}</p>}</td>
                    <td className="px-5 py-3"><p>{p.kind === "percent" ? `${p.value}% off` : `${formatNaira(p.value)} off`}{p.maxDiscount !== null && p.kind === "percent" ? `, up to ${formatNaira(p.maxDiscount)}` : ""}</p><p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">{p.services.length ? p.services.join(", ") : "All services"}{p.minSpend > 0 && ` · from ${formatNaira(p.minSpend)}`}</p></td>
                    <td className="px-5 py-3 tabular-nums">{p.used}{p.totalLimit !== null && ` / ${p.totalLimit}`}</td>
                    <td className="px-5 py-3 text-xs">{p.startsAt ? `From ${formatWhen(p.startsAt)}` : "Now"}<br />{p.expiresAt ? `Until ${formatWhen(p.expiresAt)}` : "No end date"}</td>
                    <td className="px-5 py-3">{p.active ? "On" : "Off"}</td>
                    <td className="px-5 py-3">{canManage && <div className="flex flex-wrap justify-end gap-2"><button type="button" className={btnGhost} onClick={() => setEditing({ id: p.id, draft: toDraft(p) })}>Edit</button><button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => setPromoActive(p.id, !p.active), () => undefined)}>{p.active ? "Turn off" : "Turn on"}</button><button type="button" className={btnDanger} onClick={() => setDeleting(p)}>Delete</button></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <Modal title={editing.id ? "Edit promo code" : "New promo code"} onClose={close}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" hint="4 to 20 letters or numbers."><input className={inputClass()} value={editing.draft.code} onChange={(e) => set("code", e.target.value.toUpperCase())} maxLength={20} /></Field>
            <Field label="Description"><input className={inputClass()} value={editing.draft.description} onChange={(e) => set("description", e.target.value)} maxLength={160} /></Field>
            <Field label="Type"><select className={inputClass()} value={editing.draft.kind} onChange={(e) => set("kind", e.target.value as PromoKind)}><option value="percent">Percent off</option><option value="fixed">Fixed amount off</option></select></Field>
            <Field label={editing.draft.kind === "percent" ? "Percent" : "Amount (₦)"}><input className={inputClass()} inputMode="decimal" value={editing.draft.value} onChange={(e) => set("value", e.target.value)} /></Field>
            <Field label="Discount cap (₦)" hint="Optional."><input className={inputClass()} inputMode="decimal" value={editing.draft.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} /></Field>
            <Field label="Minimum spend (₦)"><input className={inputClass()} inputMode="decimal" value={editing.draft.minSpend} onChange={(e) => set("minSpend", e.target.value)} /></Field>
            <Field label="Total uses" hint="Empty means no limit."><input className={inputClass()} inputMode="numeric" value={editing.draft.totalLimit} onChange={(e) => set("totalLimit", e.target.value)} /></Field>
            <Field label="Uses per customer"><input className={inputClass()} inputMode="numeric" value={editing.draft.perCustomerLimit} onChange={(e) => set("perCustomerLimit", e.target.value)} /></Field>
            <Field label="Starts"><input type="datetime-local" className={inputClass()} value={editing.draft.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field>
            <Field label="Ends"><input type="datetime-local" className={inputClass()} value={editing.draft.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></Field>
          </div>
          <fieldset className="mt-4"><legend className="mb-1 text-sm font-medium">Works on <span className="font-normal text-gray-600 dark:text-[#9FB3B7]">(none ticked means every service)</span></legend><div className="flex flex-wrap gap-4">{PROMO_SERVICES.map((s) => <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.draft.services.includes(s.id)} onChange={(e) => set("services", e.target.checked ? [...editing.draft.services, s.id] : editing.draft.services.filter((x) => x !== s.id))} />{s.label}</label>)}</div></fieldset>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.draft.active} onChange={(e) => set("active", e.target.checked)} /> Code is on</label>
          {error && <p role="alert" className="mt-4 text-sm text-[#C8432B]">{error}</p>}
          <div className="mt-6 flex justify-end gap-3"><button type="button" className={btnGhost} disabled={pending} onClick={close}>Cancel</button><button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => (editing.id ? updatePromo(editing.id, toInput(editing.draft)) : createPromo(toInput(editing.draft))), () => setEditing(null))}>{pending ? "Saving..." : "Save"}</button></div>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete promo code?" onClose={close}>
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">Delete {deleting.code}? A code that has been used can&apos;t be deleted. Turn it off instead.</p>
          {error && <p role="alert" className="mt-4 text-sm text-[#C8432B]">{error}</p>}
          <div className="mt-6 flex justify-end gap-3"><button type="button" className={btnGhost} disabled={pending} onClick={close}>Cancel</button><button type="button" className={btnDanger} disabled={pending} onClick={() => run(() => removePromo(deleting.id), () => setDeleting(null))}>{pending ? "Deleting..." : "Delete"}</button></div>
        </Modal>
      )}
    </>
  );
}
