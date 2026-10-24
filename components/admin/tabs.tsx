"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export type TabItem = { id: string; label: ReactNode };

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]";

/**
 * `underline` for the main tabs, `pill` for a secondary row inside a panel.
 * Renders the tab list plus a single tab panel that wraps `children`.
 */
export function Tabs({
  label,
  tabs,
  value,
  onChange,
  variant = "underline",
  children,
}: {
  label: string;
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: "underline" | "pill";
  children: ReactNode;
}) {
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (tabs.length === 0) return;
    const index = tabs.findIndex((t) => t.id === value);
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  const listClass =
    variant === "underline"
      ? "no-scrollbar flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-white/10"
      : "no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-white/5";

  return (
    <div className="min-w-0">
      <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className={listClass}>
        {tabs.map((tab) => {
          const selected = tab.id === value;
          const style =
            variant === "underline"
              ? `-mb-px shrink-0 border-b-2 px-4 py-3 text-[15px] font-medium ${
                  selected
                    ? "border-[#F2B632] text-[#12343B] dark:text-white"
                    : "border-transparent text-gray-600 hover:text-[#12343B] dark:text-[#9FB3B7] dark:hover:text-white"
                }`
              : `shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium ${
                  selected
                    ? "bg-white text-[#12343B] shadow-sm ring-1 ring-gray-200 dark:bg-white/10 dark:text-white dark:ring-white/10"
                    : "text-gray-600 hover:text-[#12343B] dark:text-[#9FB3B7] dark:hover:text-white"
                }`;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`whitespace-nowrap transition-colors ${focusRing} ${style}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${value}`} className="pt-5">
        {children}
      </div>
    </div>
  );
}
