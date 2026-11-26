"use client";

import { useState } from "react";
import { PinField } from "@/components/pin/pin-field";

export function PinDialog({
  open,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-dialog-title"
      onKeyDown={(event) => event.key === "Escape" && !pending && onCancel()}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (pin.length !== 4) return;
          onSubmit(pin);
          setPin("");
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 dark:bg-[#10262B]"
      >
        <h2 id="pin-dialog-title" className="font-semibold">Enter your PIN</h2>
        <PinField label="Transaction PIN" value={pin} onChange={setPin} autoFocus />
        {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={pending} className="h-10 rounded-xl border border-gray-300 px-4 text-sm dark:border-white/15">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || pin.length !== 4}
            className="h-10 rounded-xl bg-[#12343B] px-5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-[#F2B632] dark:text-[#12343B]"
          >
            {pending ? "Confirming..." : "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}
