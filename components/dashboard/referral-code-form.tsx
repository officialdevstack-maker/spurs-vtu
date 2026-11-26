"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyReferralCode } from "@/app/dashboard/referrals/actions";

export function ReferralCodeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <h2 className="font-semibold">Got a friend&apos;s code?</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
        Enter it before your first purchase to unlock the welcome reward.
      </p>
      <div className="mt-4 flex gap-3">
        <input
          aria-label="Referral code"
          value={code}
          maxLength={8}
          autoCapitalize="characters"
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 font-mono text-sm uppercase outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]"
        />
        <button
          type="button"
          disabled={pending || code.length !== 8}
          onClick={() => {
            setError("");
            startTransition(async () => {
              const result = await applyReferralCode(code);
              if (!result.ok) return setError(result.error);
              toast.success("Referral code applied.");
              router.refresh();
            });
          }}
          className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] hover:bg-[#E5A720] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Applying…" : "Apply"}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-[#C8432B]">{error}</p>}
    </section>
  );
}
