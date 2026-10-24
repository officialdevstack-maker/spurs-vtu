"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Gift, Plus } from "lucide-react";
import { formatNaira } from "@/lib/format";

const HIDE_KEY = "spur-hide-balance";

export function BalanceCards({ wallet, bonus }: { wallet: string; bonus: number }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
    } catch {}
  }, []);

  function toggle() {
    setHidden((current) => {
      try {
        localStorage.setItem(HIDE_KEY, current ? "0" : "1");
      } catch {}
      return !current;
    });
  }

  const show = (n: string | number) => (hidden ? "₦ ••••••" : formatNaira(typeof n === "number" ? n : parseFloat(n)));

  return (
    <section aria-label="Balances" className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col justify-between gap-8 rounded-2xl bg-[#12343B] p-6 text-[#EEF3F4] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[#B9C8CB]">Wallet balance</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tabular-nums sm:text-5xl">
              {show(wallet)}
            </p>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={hidden}
            aria-label={hidden ? "Show balances" : "Hide balances"}
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 text-[#EEF3F4] outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#F2B632]"
          >
            {hidden ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </div>

        <Link
          href="/fund-wallet"
          className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-[#F2B632] px-5 text-base font-semibold text-[#12343B] outline-none transition-colors hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#12343B]"
        >
          <Plus className="size-5" aria-hidden="true" />
          Fund wallet
        </Link>
      </div>

      <div className="flex flex-col justify-between gap-8 rounded-2xl border border-gray-200 bg-gray-100 p-6 dark:border-white/10 dark:bg-white/5 sm:p-7">
        <div>
          <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#9FB3B7]">
            <Gift className="size-4 text-[#1E8E4F] dark:text-[#4CC38A]" aria-hidden="true" />
            Bonus balance
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums sm:text-4xl">
            {show(bonus)}
          </p>
        </div>
        <Link
          href="/bonus"
          className="w-fit rounded text-sm font-semibold underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
        >
          See your bonus rewards
        </Link>
      </div>
    </section>
  );
}