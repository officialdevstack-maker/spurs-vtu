"use client";

import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The link remains visible and selectable if clipboard access is blocked.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="h-10 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] outline-none hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B]"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
