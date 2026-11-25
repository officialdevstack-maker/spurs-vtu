"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveWelcome } from "@/app/admin/announcements/welcome/actions";
import { CHANNELS, SMS_LIMIT, renderTemplate, type ChannelAvailability, type WelcomeTemplate } from "@/lib/admin/announcements";
import { btnPrimary } from "@/components/admin/modal";

const input =
  "w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]";

export function WelcomeManager({
  templates,
  availability,
}: {
  templates: WelcomeTemplate[];
  availability: ChannelAvailability;
}) {
  const [items, setItems] = useState(templates);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const update = (channel: string, patch: Partial<WelcomeTemplate>) =>
    setItems((current) => current.map((t) => (t.channel === channel ? { ...t, ...patch } : t)));

  function save() {
    setError("");
    startTransition(async () => {
      const result = await saveWelcome(items);
      if (!result.ok) return setError(result.error);
      toast.success("Welcome message saved.");
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
        Use <code className="rounded bg-gray-100 px-1 dark:bg-white/10">{"{name}"}</code> for the customer&apos;s first
        name and <code className="rounded bg-gray-100 px-1 dark:bg-white/10">{"{username}"}</code> for their username.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {CHANNELS.map((meta) => {
          const t = items.find((item) => item.channel === meta.id);
          if (!t) return null;
          const status = availability[meta.id];
          const preview = renderTemplate(t.body, { name: "Jane Doe", username: "jane" });
          return (
            <section key={meta.id} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">{meta.label}</h2>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-[#9FB3B7]">{status.available ? meta.hint : status.reason}</p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={t.enabled && status.available} disabled={!status.available}
                    onChange={(e) => update(meta.id, { enabled: e.target.checked })} /> On
                </label>
              </div>
              <fieldset disabled={!status.available} className="space-y-3 disabled:opacity-50">
                {meta.hasSubject && (
                  <label className="block text-sm font-medium">
                    {meta.id === "email" ? "Subject" : "Title"}
                    <input className={`${input} mt-1 h-11`} value={t.subject} maxLength={120}
                      onChange={(e) => update(meta.id, { subject: e.target.value })} />
                  </label>
                )}
                <label className="block text-sm font-medium">
                  Message
                  <textarea className={`${input} mt-1 min-h-28 py-2`} value={t.body}
                    onChange={(e) => update(meta.id, { body: e.target.value })} />
                </label>
                {meta.id === "sms" && (
                  <p className={`text-xs ${t.body.length > SMS_LIMIT ? "text-[#C8432B]" : "text-gray-600 dark:text-[#9FB3B7]"}`}>
                    {t.body.length}/{SMS_LIMIT} characters
                  </p>
                )}
              </fieldset>
              {t.body && (
                <div className="rounded-xl bg-gray-100 p-3 text-sm dark:bg-white/5">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-[#9FB3B7]">Preview</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{preview}</p>
                </div>
              )}
            </section>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
      <button type="button" className={btnPrimary} disabled={pending} onClick={save}>
        {pending ? "Saving..." : "Save welcome message"}
      </button>
    </div>
  );
}
