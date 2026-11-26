"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkMeter } from "@/app/dashboard/electricity/actions";
import { METER_PATTERN, type MeterLookup } from "@/lib/electricity-purchase";
import { formatNaira } from "@/lib/format";

export type MeterCheck = { status: "idle" } | { status: "checking" } | MeterLookup;
const IDLE: MeterCheck = { status: "idle" };

export function useMeterCheck(enabled: boolean) {
  const [check, setCheck] = useState<MeterCheck>(IDLE);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    seq.current++;
    setCheck(IDLE);
  }, []);

  const schedule = useCallback(
    (discoId: string, meterType: string, meter: string) => {
      clearTimeout(timer.current);
      const id = ++seq.current;
      if (!enabled || !discoId || !METER_PATTERN.test(meter)) {
        setCheck(IDLE);
        return;
      }
      setCheck({ status: "checking" });
      timer.current = setTimeout(async () => {
        try {
          const result = await checkMeter({ discoId, meterType, meter });
          if (id === seq.current) setCheck(result);
        } catch {
          if (id === seq.current) setCheck({ status: "unavailable" });
        }
      }, 600);
    },
    [enabled],
  );

  const verified = !enabled || check.status === "found" || check.status === "unavailable";
  return { check, schedule, reset, verified };
}

export function MeterCheckNote({ check, onRetry }: { check: MeterCheck; onRetry: () => void }) {
  return (
    <div aria-live="polite" className="mt-2 min-h-5 text-sm">
      {check.status === "checking" && <p className="text-gray-600 dark:text-[#9FB3B7]">Checking meter…</p>}
      {check.status === "found" && (
        <p className="rounded-xl border border-[#1E8E4F]/40 bg-[#E6F4EC] px-4 py-3 text-[#14693A] dark:bg-[#4CC38A]/10 dark:text-[#4CC38A]">
          <span className="block text-xs">Meter owner</span>
          <span className="font-semibold">{check.name}</span>
          {check.address && <span className="block text-xs">{check.address}</span>}
          {check.balance !== null && <span className="mt-1 block text-xs">Balance: {formatNaira(check.balance)}</span>}
          <span className="block text-xs">Not who you expected? Check the number before you pay.</span>
        </p>
      )}
      {check.status === "invalid" && (
        <p role="alert" className="text-[#C8432B]">We couldn&apos;t find that meter number for this disco and meter type. Check it and try again.</p>
      )}
      {check.status === "unavailable" && (
        <p className="text-gray-600 dark:text-[#9FB3B7]">
          We couldn&apos;t check this meter. Double-check it before you pay.{" "}
          <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-4">Try again</button>
        </p>
      )}
    </div>
  );
}
