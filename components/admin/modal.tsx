"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export const inputClass = (invalid = false) =>
  `h-12 w-full rounded-xl border bg-white px-4 text-base text-[#12343B] outline-none transition-colors placeholder:text-[#7C9195] focus-visible:border-[#12343B] focus-visible:ring-2 focus-visible:ring-[#12343B]/25 ${
    invalid ? "border-[#C8432B]" : "border-[#BFCFD2]"
  }`;

export const btnPrimary =
  "h-11 rounded-xl bg-[#F2B632] px-5 text-base font-semibold text-[#12343B] outline-none transition-colors hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-[#F2B632] dark:focus-visible:ring-offset-[#10262B]";

export const btnGhost =
  "h-11 rounded-xl border border-gray-300 px-5 text-base font-medium outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10 dark:focus-visible:ring-[#F2B632]";

export const btnDanger =
  "h-11 rounded-xl bg-[#C8432B] px-5 text-base font-semibold text-white outline-none transition-colors hover:bg-[#B03A24] focus-visible:ring-2 focus-visible:ring-[#C8432B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#10262B]";

export const btnIcon =
  "grid size-9 shrink-0 place-items-center rounded-lg text-gray-600 outline-none transition-colors hover:bg-gray-200/70 hover:text-[#12343B] focus-visible:ring-2 focus-visible:ring-[#12343B] dark:text-[#9FB3B7] dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-[#F2B632]";

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-[#C8432B] bg-white px-4 py-3 text-sm text-[#C8432B]">
      {children}
    </p>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-note`} role="alert" className="mt-2 text-sm text-[#C8432B]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-note`} className="mt-2 text-sm text-gray-600 dark:text-[#9FB3B7]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-[#12343B] shadow-2xl backdrop:bg-[#0B1B1F]/60 dark:bg-[#10262B] dark:text-[#EEF3F4]"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-[family-name:var(--font-display)] text-xl font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className={btnIcon}>
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
