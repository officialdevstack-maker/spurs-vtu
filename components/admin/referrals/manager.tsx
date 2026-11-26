"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveReferrals } from "@/app/admin/products/referrals/actions";
import type { ReferralSettings } from "@/lib/admin/referrals";

const input =
  "h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:opacity-60 dark:border-white/15 dark:bg-[#10262B]";

const FIELDS: { key: keyof Omit<ReferralSettings, "enabled">; label: string; hint: string }[] = [
  { key: "referrerReward", label: "Referrer reward (₦)", hint: "Cashback for the person who invited." },
  { key: "refereeReward", label: "Welcome reward (₦)", hint: "Cashback for the new customer." },
  { key: "minPurchase", label: "Minimum first purchase (₦)", hint: "Counted on what is paid from the main wallet, not cashback." },
  { key: "monthlyLimit", label: "Rewarded referrals per person per month", hint: "Past this, the referrer earns nothing more that month." },
];

export function ReferralsManager({ settings, canManage }: { settings: ReferralSettings; canManage: boolean }) {
  const [value, setValue] = useState(settings);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveReferrals(value);
      if (result.ok) toast.success("Referral settings saved.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={!canManage}
          onChange={(event) => setValue({ ...value, enabled: event.target.checked })}
          className="mt-1 size-4"
        />
        <span>
          <span className="block font-semibold">Referral rewards are {value.enabled ? "on" : "off"}</span>
          <span className="block text-sm text-gray-600 dark:text-[#9FB3B7]">
            When off, links still record who invited whom, but no rewards are paid. Pending referrals can be rewarded later.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1 block text-sm font-medium">{field.label}</span>
            <input
              className={input}
              type="number"
              min={0}
              step={field.key === "monthlyLimit" ? 1 : "0.01"}
              value={value[field.key]}
              disabled={!canManage}
              onChange={(event) => setValue({ ...value, [field.key]: Number(event.target.value) })}
            />
            <span className="mt-1 block text-xs text-gray-600 dark:text-[#9FB3B7]">{field.hint}</span>
          </label>
        ))}
      </div>

      {canManage && (
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-11 rounded-xl bg-[#F2B632] px-6 text-sm font-semibold text-[#12343B] outline-none hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      )}
    </div>
  );
}
