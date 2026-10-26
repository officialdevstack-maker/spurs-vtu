"use client";

import { useId } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { NETWORK_NAMES, checkNetwork } from "@/lib/network-prefix";

export function NetworkCheck({
  phone,
  networkId,
  networkName,
  available,
  bypass,
  onBypass,
  onSwitch,
}: {
  phone: string;
  networkId: string;
  networkName: string;
  available: { id: string; name: string }[];
  bypass: boolean;
  onBypass: (next: boolean) => void;
  onSwitch: (id: string) => void;
}) {
  const boxId = useId();
  const check = checkNetwork(phone, networkId);
  if (check.status === "incomplete" || check.status === "unknown") return null;

  const detectedName = NETWORK_NAMES[check.detected] ?? check.detected;

  if (check.status === "match") {
    return (
      <p role="status" className="mt-2 flex items-center gap-1.5 text-sm text-gray-600 dark:text-[#9FB3B7]">
        <CheckCircle2 className="size-4 text-[#1E8E4F] dark:text-[#4CC38A]" aria-hidden="true" />
        Looks like a {detectedName} number.
      </p>
    );
  }

  const target = available.find((item) => item.id === check.detected);

  return (
    <div
      role="alert"
      className="mt-3 space-y-3 rounded-xl border border-[#F2B632]/60 bg-[#FFF8E1] p-4 dark:border-[#F2B632]/30 dark:bg-[#F2B632]/10"
    >
      <p className="flex items-start gap-2 text-sm text-[#5C4A12] dark:text-[#D9C48A]">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#7A5600] dark:text-[#F2B632]" aria-hidden="true" />
        <span>
          This looks like a <strong>{detectedName}</strong> number, but <strong>{networkName}</strong> is selected.
        </span>
      </p>

      {target && (
        <button
          type="button"
          onClick={() => onSwitch(target.id)}
          className="rounded-lg border border-[#12343B] px-3 py-1.5 text-sm font-semibold text-[#12343B] outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-[#F2B632] dark:text-[#F2B632] dark:hover:bg-white/10 dark:focus-visible:ring-[#F2B632]"
        >
          Switch to {target.name}
        </button>
      )}

      <label htmlFor={boxId} className="flex cursor-pointer items-start gap-3 text-sm font-medium text-[#12343B] dark:text-[#EEF3F4]">
        <input
          id={boxId}
          type="checkbox"
          checked={bypass}
          onChange={(event) => onBypass(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[#1E8E4F]"
        />
        <span>This number is on {networkName} (for example, it was ported). Buy anyway.</span>
      </label>
    </div>
  );
}
