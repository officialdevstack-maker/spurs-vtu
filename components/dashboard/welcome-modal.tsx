"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { markWelcomeSeen } from "@/app/dashboard/welcome-actions";

export function WelcomeModal({ title, body, ctaLabel, ctaHref, version }: { title: string; body: string; ctaLabel: string; ctaHref: string; version: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  const marked = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function onClose() {
    if (marked.current) return;
    marked.current = true;
    void markWelcomeSeen(version);
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="welcome-title" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-6 text-[#12343B] shadow-2xl backdrop:bg-black/50 dark:bg-[#10262B] dark:text-[#EEF3F4]">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-[#F2B632] font-[family-name:var(--font-display)] text-xl font-bold text-[#12343B]">S</span>
      <h2 id="welcome-title" className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-[#9FB3B7]">{body}</p>
      <div className="mt-6 flex flex-col gap-2">
        {ctaLabel && ctaHref && (
          <Link href={ctaHref} onClick={() => ref.current?.close()} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#F2B632] px-4 text-sm font-semibold text-[#12343B] outline-none hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]">{ctaLabel}</Link>
        )}
        <button type="button" onClick={() => ref.current?.close()} className="inline-flex h-11 items-center justify-center rounded-xl text-sm font-medium text-gray-600 outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:text-[#9FB3B7] dark:hover:bg-white/5 dark:focus-visible:ring-[#F2B632]">{ctaLabel ? "Maybe later" : "Got it"}</button>
      </div>
    </dialog>
  );
}
