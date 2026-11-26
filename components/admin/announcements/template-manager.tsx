"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveTemplates } from "@/app/admin/announcements/templates/actions";
import {
  DEFAULT_MESSAGES,
  MESSAGE_LIMIT,
  PURCHASE_SERVICES,
  PURCHASE_STATUSES,
  placeholdersFor,
  renderMessage,
  sampleVars,
  type PurchaseService,
  type PurchaseStatus,
  type PurchaseTemplate,
} from "@/lib/admin/purchase-templates";

const keyOf = (service: PurchaseService, status: PurchaseStatus) => `${service}:${status}`;
const STATUS_DOT: Record<PurchaseStatus, string> = {
  success: "bg-[#1E8E4F] dark:bg-[#4CC38A]",
  pending: "bg-[#F2B632]",
  failed: "bg-[#C8432B]",
};

export function TemplateManager({ templates }: { templates: PurchaseTemplate[] }) {
  const [messages, setMessages] = useState<Record<string, string>>(() => Object.fromEntries(templates.map((t) => [keyOf(t.service, t.status), t.message])));
  const [service, setService] = useState<PurchaseService>("airtime");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function set(status: PurchaseStatus, value: string) { setMessages((current) => ({ ...current, [keyOf(service, status)]: value })); }
  function save() {
    setError("");
    const payload: PurchaseTemplate[] = PURCHASE_SERVICES.flatMap((s) => PURCHASE_STATUSES.map((st) => ({ service: s.id, status: st.id, message: messages[keyOf(s.id, st.id)] ?? "" })));
    startTransition(async () => {
      const result = await saveTemplates(payload);
      if (!result.ok) return setError(result.error);
      toast.success("Templates saved.");
    });
  }
  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Service" className="flex flex-wrap gap-2">
        {PURCHASE_SERVICES.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={service === item.id} onClick={() => setService(item.id)} className={`h-10 rounded-xl px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632] ${service === item.id ? "bg-[#12343B] text-white dark:bg-[#F2B632] dark:text-[#12343B]" : "border border-gray-300 hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10"}`}>{item.label}</button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {PURCHASE_STATUSES.map((status) => {
          const key = keyOf(service, status.id);
          const value = messages[key] ?? "";
          const isDefault = value === DEFAULT_MESSAGES[service][status.id];
          const placeholders = placeholdersFor(service, status.id);
          return (
            <section key={key} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center gap-2"><span aria-hidden="true" className={`size-2.5 rounded-full ${STATUS_DOT[status.id]}`} /><h2 className="font-[family-name:var(--font-display)] text-lg font-bold">{status.label}</h2></div>
              <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">{status.hint}</p>
              <label htmlFor={`msg-${key}`} className="sr-only">{status.label} message</label>
              <textarea id={`msg-${key}`} value={value} rows={5} maxLength={MESSAGE_LIMIT} onChange={(e) => set(status.id, e.target.value)} className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B] dark:focus-visible:ring-[#F2B632]" />
              <div className="mt-1 flex items-center justify-between text-xs text-gray-600 dark:text-[#9FB3B7]">
                <span>{value.length}/{MESSAGE_LIMIT}</span>
                <button type="button" disabled={isDefault} onClick={() => set(status.id, DEFAULT_MESSAGES[service][status.id])} className="rounded underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:no-underline disabled:opacity-40">Reset to default</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {placeholders.map((p) => <button key={p.key} type="button" title={p.hint} onClick={() => set(status.id, `${value}{${p.key}}`)} className="rounded-md border border-gray-300 px-2 py-0.5 font-mono text-xs hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10">{`{${p.key}}`}</button>)}
              </div>
              <div className="mt-4 rounded-xl bg-gray-100 p-3 text-sm dark:bg-white/5"><p className="mb-1 text-xs font-medium text-gray-600 dark:text-[#9FB3B7]">Preview</p>{renderMessage(value, sampleVars(service)) || "—"}</div>
            </section>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
      <button type="button" onClick={save} disabled={pending} className="h-11 rounded-xl bg-[#F2B632] px-6 text-sm font-semibold text-[#12343B] hover:bg-[#E5A720] disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Saving..." : "Save templates"}</button>
    </div>
  );
}
