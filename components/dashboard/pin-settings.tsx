"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changePinAction, removePinAction, requestPinReset } from "@/app/pin/actions";
import { PinField } from "@/components/pin/pin-field";
import type { PinResult } from "@/lib/pin";

const card = "rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5";
const muted = "text-gray-600 dark:text-[#9FB3B7]";
const btn = "h-10 rounded-xl border border-gray-300 px-4 text-sm font-medium text-[#12343B] outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:opacity-60 dark:border-white/15 dark:text-[#F2B632] dark:focus-visible:ring-[#F2B632]";
const primaryBtn = "h-10 rounded-xl bg-[#F2B632] px-4 text-sm font-semibold text-[#12343B] outline-none transition-colors hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-[#F2B632] dark:focus-visible:ring-offset-[#0B1B1F]";

export function PinSettings({ hasPin }: { hasPin: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "change" | "remove">("idle");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, start] = useTransition();

  function run(task: () => Promise<PinResult>, done: string) {
    start(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(done);
        setMode("idle");
        setCurrent("");
        setNext("");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Try again.");
      }
    });
  }

  return (
    <section className={card}>
      <h2 className="font-semibold">Transaction PIN</h2>
      {!hasPin ? (
        <>
          <p className={`mt-1 text-sm ${muted}`}>PIN is off. Purchases go through without asking for one.</p>
          <Link href="/pin/setup" className={`${primaryBtn} mt-4 inline-flex items-center`}>Turn on PIN</Link>
        </>
      ) : (
        <>
          <p className={`mt-1 text-sm ${muted}`}>You enter this 4-digit PIN to confirm purchases and package upgrades.</p>
          {mode === "idle" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={primaryBtn} onClick={() => setMode("change")}>Change PIN</button>
              <button type="button" className={primaryBtn} onClick={() => setMode("remove")}>Turn off PIN</button>
              <button type="button" className={primaryBtn} disabled={pending} onClick={() => run(requestPinReset, "Check your email for the reset link")}>
                Forgot PIN? Email me a link
              </button>
            </div>
          )}
          {mode !== "idle" && (
            <div className="mt-4 max-w-xs space-y-3">
              <PinField label="Current PIN" value={current} onChange={setCurrent} autoFocus />
              {mode === "change" && <PinField label="New PIN" value={next} onChange={setNext} />}
              <div className="flex gap-2">
                <button
                  type="button"
                  className={primaryBtn}
                  disabled={pending || current.length !== 4 || (mode === "change" && next.length !== 4)}
                  onClick={() => mode === "change"
                    ? run(() => changePinAction(current, next), "PIN changed")
                    : run(() => removePinAction(current), "PIN turned off")}
                >
                  {pending ? "Saving..." : mode === "change" ? "Save new PIN" : "Turn off PIN"}
                </button>
                <button type="button" className={btn} disabled={pending} onClick={() => { setMode("idle"); setCurrent(""); setNext(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
