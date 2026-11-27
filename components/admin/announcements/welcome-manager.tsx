"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveWelcome } from "@/app/admin/announcements/welcome/actions";
import { POPUP_BODY_LIMIT, POPUP_CTA_LIMIT, POPUP_TITLE_LIMIT, renderTemplate, type WelcomePopup } from "@/lib/admin/announcements";

const field = "w-full rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B] dark:focus-visible:ring-[#F2B632]";

export function WelcomeManager({ popup }: { popup: WelcomePopup }) {
  const [enabled, setEnabled] = useState(popup.enabled);
  const [title, setTitle] = useState(popup.title);
  const [body, setBody] = useState(popup.body);
  const [ctaLabel, setCtaLabel] = useState(popup.ctaLabel);
  const [ctaHref, setCtaHref] = useState(popup.ctaHref);
  const [showAgain, setShowAgain] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const sample = { name: "Jane Doe", username: "jane" };

  function save() {
    setError("");
    startTransition(async () => {
      const result = await saveWelcome({ enabled, title, body, ctaLabel, ctaHref, showAgain });
      if (!result.ok) return setError(result.error);
      setShowAgain(false);
      toast.success("Welcome message saved.");
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4" />
          Show this popup to customers
        </label>
        <div>
          <label htmlFor="welcome-title" className="mb-2 block text-sm font-medium">Title</label>
          <input id="welcome-title" value={title} maxLength={POPUP_TITLE_LIMIT} onChange={(e) => setTitle(e.target.value)} className={`${field} h-11`} />
        </div>
        <div>
          <label htmlFor="welcome-body" className="mb-2 block text-sm font-medium">Message</label>
          <textarea id="welcome-body" value={body} maxLength={POPUP_BODY_LIMIT} rows={5} onChange={(e) => setBody(e.target.value)} className={`${field} py-3`} />
          <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">{body.length}/{POPUP_BODY_LIMIT}. Use {"{name}"} for the customer&apos;s first name and {"{username}"} for their username.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="welcome-cta" className="mb-2 block text-sm font-medium">Button label (optional)</label>
            <input id="welcome-cta" value={ctaLabel} maxLength={POPUP_CTA_LIMIT} onChange={(e) => setCtaLabel(e.target.value)} className={`${field} h-11`} />
          </div>
          <div>
            <label htmlFor="welcome-href" className="mb-2 block text-sm font-medium">Button link</label>
            <input id="welcome-href" value={ctaHref} placeholder="/fund-wallet" onChange={(e) => setCtaHref(e.target.value)} className={`${field} h-11`} />
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={showAgain} onChange={(e) => setShowAgain(e.target.checked)} className="mt-0.5 size-4" />
          <span>Show again to customers who already dismissed it<span className="block text-xs text-gray-600 dark:text-[#9FB3B7]">Tick this when you change the message and want everyone to see it again.</span></span>
        </label>
        {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
        <button type="button" onClick={save} disabled={pending} className="h-11 rounded-xl bg-[#F2B632] px-6 text-sm font-semibold text-[#12343B] hover:bg-[#E5A720] disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Saving..." : "Save"}</button>
      </section>
      <section aria-label="Preview">
        <p className="mb-3 text-sm font-medium text-gray-600 dark:text-[#9FB3B7]">Preview</p>
        <div className="grid place-items-center rounded-2xl bg-gray-100 p-8 dark:bg-white/5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-[#12343B] shadow-xl dark:bg-[#10262B] dark:text-[#EEF3F4]">
            <Image src="/logo.png" alt="" width={44} height={44} className="rounded-xl" />
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">{renderTemplate(title, sample) || "Your title"}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-[#9FB3B7]">{renderTemplate(body, sample) || "Your message"}</p>
            <div className="mt-6 flex flex-col gap-2">
              {ctaLabel && <span className="inline-flex h-11 items-center justify-center rounded-xl bg-[#F2B632] px-4 text-sm font-semibold text-[#12343B]">{ctaLabel}</span>}
              <span className="inline-flex h-11 items-center justify-center rounded-xl text-sm font-medium text-gray-600 dark:text-[#9FB3B7]">Maybe later</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
