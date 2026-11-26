"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal, btnDanger, btnGhost, btnPrimary } from "@/components/admin/modal";
import {
  createTemplate,
  removeTemplate,
  setTemplateActive,
  updateTemplate,
} from "@/app/admin/announcements/templates/actions";
import {
  DEFAULT_MESSAGES,
  MESSAGE_LIMIT,
  NAME_LIMIT,
  PURCHASE_SERVICES,
  PURCHASE_STATUSES,
  placeholdersFor,
  renderMessage,
  sampleVars,
  type PurchaseService,
  type PurchaseStatus,
  type PurchaseTemplate,
} from "@/lib/admin/purchase-templates";

const field =
  "w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B] dark:focus-visible:ring-[#F2B632]";

const serviceLabel = (id: PurchaseService) => PURCHASE_SERVICES.find((s) => s.id === id)?.label ?? id;
const statusLabel = (id: PurchaseStatus) => PURCHASE_STATUSES.find((s) => s.id === id)?.label ?? id;

const STATUS_CHIP: Record<PurchaseStatus, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300",
  pending: "bg-[#FFF3D1] text-[#7A5600] dark:bg-[#F2B632]/15 dark:text-[#F2B632]",
  failed: "bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-300",
};

type Editing = { template?: PurchaseTemplate; preset?: { service: PurchaseService; status: PurchaseStatus } };

function TemplateForm({
  editing,
  all,
  onClose,
}: {
  editing: Editing;
  all: PurchaseTemplate[];
  onClose: () => void;
}) {
  const router = useRouter();
  const existing = editing.template;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState(existing?.name ?? "");
  const [service, setService] = useState<PurchaseService>(existing?.service ?? editing.preset?.service ?? "airtime");
  const [status, setStatus] = useState<PurchaseStatus>(existing?.status ?? editing.preset?.status ?? "success");
  const [message, setMessage] = useState(
    existing?.message ??
      (editing.preset ? DEFAULT_MESSAGES[editing.preset.service][editing.preset.status] : DEFAULT_MESSAGES.airtime.success),
  );
  const [active, setActive] = useState(existing?.active ?? true);
  const [edited, setEdited] = useState(!!existing);

  const placeholders = placeholdersFor(service, status);
  const liveOther = all.find((t) => t.service === service && t.status === status && t.active && t.id !== existing?.id);

  function pick(nextService: PurchaseService, nextStatus: PurchaseStatus) {
    setService(nextService);
    setStatus(nextStatus);
    if (!edited) setMessage(DEFAULT_MESSAGES[nextService][nextStatus]);
  }

  function save() {
    setError("");
    const input = { name, service, status, message, active };
    startTransition(async () => {
      const result = existing ? await updateTemplate(existing.id, input) : await createTemplate(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(existing ? "Template saved." : "Template added.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal title={existing ? "Edit template" : "Add template"} onClose={() => !pending && onClose()}>
      <div className="max-h-[70dvh] space-y-4 overflow-y-auto pr-1">
        <div>
          <label htmlFor="tpl-name" className="mb-1.5 block text-sm font-medium">Name</label>
          <input
            id="tpl-name"
            value={name}
            maxLength={NAME_LIMIT}
            placeholder="e.g. Friendly airtime success"
            onChange={(e) => setName(e.target.value)}
            className={`${field} h-11`}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tpl-service" className="mb-1.5 block text-sm font-medium">Service</label>
            <select
              id="tpl-service"
              value={service}
              onChange={(e) => pick(e.target.value as PurchaseService, status)}
              className={`${field} h-11`}
            >
              {PURCHASE_SERVICES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tpl-status" className="mb-1.5 block text-sm font-medium">Shown when</label>
            <select
              id="tpl-status"
              value={status}
              onChange={(e) => pick(service, e.target.value as PurchaseStatus)}
              className={`${field} h-11`}
            >
              {PURCHASE_STATUSES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="tpl-message" className="mb-1.5 block text-sm font-medium">Message</label>
          <textarea
            id="tpl-message"
            value={message}
            rows={4}
            maxLength={MESSAGE_LIMIT}
            onChange={(e) => {
              setEdited(true);
              setMessage(e.target.value);
            }}
            className={`${field} py-2.5`}
          />
          <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">{message.length}/{MESSAGE_LIMIT}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {placeholders.map((p) => (
              <button
                key={p.key}
                type="button"
                title={p.hint}
                onClick={() => {
                  setEdited(true);
                  setMessage((current) => `${current}{${p.key}}`);
                }}
                className="rounded-md border border-gray-300 px-2 py-0.5 font-mono text-xs hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10"
              >
                {`{${p.key}}`}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-gray-100 p-3 text-sm dark:bg-white/5">
          <p className="mb-1 text-xs font-medium text-gray-600 dark:text-[#9FB3B7]">Preview</p>
          {renderMessage(message, sampleVars(service)) || "—"}
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="mt-0.5 size-4" />
          <span>
            Live
            <span className="block text-xs text-gray-600 dark:text-[#9FB3B7]">
              {active && liveOther
                ? `This replaces "${liveOther.name}" as the live ${serviceLabel(service)} ${statusLabel(status).toLowerCase()} message.`
                : "Customers see this message for this service and status."}
            </span>
          </span>
        </label>
        {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className={btnGhost} disabled={pending} onClick={onClose}>Cancel</button>
        <button type="button" className={btnPrimary} disabled={pending} onClick={save}>
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

export function TemplateManager({ templates }: { templates: PurchaseTemplate[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<PurchaseTemplate | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [query, setQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<PurchaseService | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "all">("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter(
      (t) =>
        (serviceFilter === "all" || t.service === serviceFilter) &&
        (statusFilter === "all" || t.status === statusFilter) &&
        (!needle || t.name.toLowerCase().includes(needle) || t.message.toLowerCase().includes(needle)),
    );
  }, [templates, query, serviceFilter, statusFilter]);

  const usingDefault = useMemo(
    () =>
      PURCHASE_SERVICES.flatMap((s) =>
        PURCHASE_STATUSES.filter((st) => !templates.some((t) => t.active && t.service === s.id && t.status === st.id)).map(
          (st) => ({ service: s.id, status: st.id }),
        ),
      ),
    [templates],
  );

  function toggle(template: PurchaseTemplate) {
    startTransition(async () => {
      const result = await setTemplateActive(template.id, !template.active);
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
      const result = await removeTemplate(deleting.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      toast.success("Template deleted.");
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-100 p-4 sm:flex-row sm:items-center dark:border-white/10 dark:bg-white/5">
        <label className="sr-only" htmlFor="tpl-search">Search templates</label>
        <input
          id="tpl-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or message"
          className={`${field} h-11 min-w-0 flex-1`}
        />
        <label className="sr-only" htmlFor="tpl-filter-service">Filter by service</label>
        <select
          id="tpl-filter-service"
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value as PurchaseService | "all")}
          className={`${field} h-11 sm:w-44`}
        >
          <option value="all">All services</option>
          {PURCHASE_SERVICES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="tpl-filter-status">Filter by status</label>
        <select
          id="tpl-filter-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PurchaseStatus | "all")}
          className={`${field} h-11 sm:w-44`}
        >
          <option value="all">All statuses</option>
          {PURCHASE_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button type="button" className={`${btnPrimary} inline-flex shrink-0 items-center justify-center gap-2`} onClick={() => setEditing({})}>
          <Plus className="size-4" aria-hidden="true" />
          Add template
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {visible.length === 0 ? (
          <div className="p-10 text-center">
            <MessageSquareText className="mx-auto size-8 text-gray-400" aria-hidden="true" />
            <p className="mt-3 font-medium">{templates.length === 0 ? "No templates yet" : "No templates match"}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
              {templates.length === 0
                ? "Customers are seeing the built-in messages. Add a template to change them."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-white/5 dark:text-[#9FB3B7]">
                <tr>
                  <th scope="col" className="px-5 py-3">Template</th>
                  <th scope="col" className="px-5 py-3">Service</th>
                  <th scope="col" className="px-5 py-3">Shown when</th>
                  <th scope="col" className="px-5 py-3">Message</th>
                  <th scope="col" className="px-5 py-3">Live</th>
                  <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td className="px-5 py-4 font-medium">{t.name}</td>
                    <td className="whitespace-nowrap px-5 py-4">{serviceLabel(t.service)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CHIP[t.status]}`}>
                        {statusLabel(t.status)}
                      </span>
                    </td>
                    <td className="max-w-sm px-5 py-4">
                      <p className="line-clamp-2 text-gray-700 dark:text-[#D5E0E2]">{t.message}</p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={t.active}
                        aria-label={`${t.name} is ${t.active ? "live" : "off"}`}
                        disabled={pending}
                        onClick={() => toggle(t)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:opacity-60 dark:focus-visible:ring-[#F2B632] ${
                          t.active ? "bg-[#1E8E4F] dark:bg-[#4CC38A]" : "bg-gray-300 dark:bg-white/20"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`inline-block size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
                            t.active ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" aria-label={`Edit ${t.name}`} title="Edit" className={btnGhost} onClick={() => setEditing({ template: t })}>
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${t.name}`}
                          title="Delete"
                          className={btnGhost}
                          onClick={() => {
                            setDeleteError("");
                            setDeleting(t);
                          }}
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
      </section>

      {usingDefault.length > 0 && (
        <details className="rounded-2xl border border-gray-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-white/5">
          <summary className="cursor-pointer text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]">
            Using built-in default ({usingDefault.length})
          </summary>
          <ul className="mt-3 divide-y divide-gray-200 dark:divide-white/10">
            {usingDefault.map((item) => (
              <li key={`${item.service}:${item.status}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{serviceLabel(item.service)} · {statusLabel(item.status)}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-gray-600 dark:text-[#9FB3B7]">
                    {DEFAULT_MESSAGES[item.service][item.status]}
                  </p>
                </div>
                <button type="button" className={btnGhost} onClick={() => setEditing({ preset: item })}>Customise</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing && (
        <TemplateForm
          key={editing.template?.id ?? `new-${editing.preset?.service ?? ""}-${editing.preset?.status ?? ""}`}
          editing={editing}
          all={templates}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <Modal title="Delete template?" onClose={() => !pending && setDeleting(null)}>
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            Delete &quot;{deleting.name}&quot;?
            {deleting.active
              ? ` Customers will see the built-in ${serviceLabel(deleting.service)} ${statusLabel(deleting.status).toLowerCase()} message until you make another template live.`
              : " It isn't live, so customers won't notice."}
          </p>
          {deleteError && <p role="alert" className="mt-4 text-sm text-[#C8432B]">{deleteError}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={pending} onClick={() => setDeleting(null)}>Cancel</button>
            <button type="button" className={btnDanger} disabled={pending} onClick={confirmDelete}>
              {pending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
