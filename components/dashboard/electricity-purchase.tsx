"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { purchaseElectricity } from "@/app/dashboard/electricity/actions";
import {
  METER_PATTERN,
  METER_TYPES,
  QUICK_AMOUNTS,
  electricityPrice,
  type ElectricityDisco,
  type MeterType,
} from "@/lib/electricity-purchase";
import { formatNaira } from "@/lib/format";
import { PHONE_PATTERN, groupPhone, normalizePhone } from "@/lib/phone";

const field =
  "h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B] dark:focus-visible:ring-[#F2B632]";

export function ElectricityPurchase({
  discos,
  balance,
  defaultPhone,
}: {
  discos: ElectricityDisco[];
  balance: number | null;
  defaultPhone?: string;
}) {
  const ids = useId();
  const reference = useRef(crypto.randomUUID());
  const [pending, startTransition] = useTransition();
  const [discoId, setDiscoId] = useState(discos[0]?.id ?? "");
  const [meterType, setMeterType] = useState<MeterType>("prepaid");
  const [meter, setMeter] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(normalizePhone(defaultPhone ?? ""));
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ status: "success" | "pending"; message: string } | null>(null);

  const disco = discos.find((item) => item.id === discoId);
  const value = Number(amount);
  const validAmount = !!disco && Number.isInteger(value) && value >= disco.min && value <= disco.max;
  const price = disco && validAmount ? electricityPrice(value, disco.discount) : null;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !disco) return;
    setResult(null);
    if (!METER_PATTERN.test(meter)) return setError("Enter your meter number, 10 to 13 digits.");
    if (!validAmount) return setError(`Enter an amount from ${formatNaira(disco.min)} to ${formatNaira(disco.max)}.`);
    if (!PHONE_PATTERN.test(phone)) return setError("Enter an 11-digit phone number, like 0803 123 4567.");
    if (price !== null && balance !== null && balance < price) {
      return setError(`Your wallet balance is ${formatNaira(balance)}. Fund your wallet to continue.`);
    }
    setError("");

    startTransition(async () => {
      try {
        const res = await purchaseElectricity({
          discoId,
          meterType,
          meter,
          amount: value,
          phone,
          reference: reference.current,
        });
        reference.current = crypto.randomUUID();
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        setResult({ status: res.status, message: res.message });
        res.status === "success" ? toast.success("Payment successful.") : toast.message("Order is being confirmed.");
        setMeter("");
        setAmount("");
      } catch {
        setError("We couldn't reach the server. Check your history before trying again.");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      {balance !== null && (
        <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
          Wallet balance: <span className="font-semibold tabular-nums text-[#12343B] dark:text-[#EEF3F4]">{formatNaira(balance)}</span>
        </p>
      )}

      {result && (
        <div role="status" className="rounded-2xl border border-[#F2B632]/60 bg-[#FFF8E1] p-5 text-sm text-[#12343B] dark:border-[#F2B632]/30 dark:bg-[#F2B632]/10 dark:text-[#EEF3F4]">
          <p className="font-semibold">{result.status === "success" ? "Payment successful" : "Order pending"}</p>
          <p className="mt-1 break-words">{result.message}</p>
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div>
          <label htmlFor={`${ids}-disco`} className="mb-2 block text-sm font-medium">Distribution company</label>
          <select id={`${ids}-disco`} className={field} value={discoId} onChange={(e) => setDiscoId(e.target.value)}>
            {discos.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Meter type</legend>
          <div className="grid grid-cols-2 gap-3">
            {METER_TYPES.map((type) => (
              <label key={type.id} className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold ${meterType === type.id ? "border-[#12343B] bg-[#12343B] text-white dark:border-[#F2B632] dark:bg-[#F2B632] dark:text-[#12343B]" : "border-gray-300 dark:border-white/15"}`}>
                <input type="radio" name="meter-type" className="sr-only" checked={meterType === type.id} onChange={() => setMeterType(type.id)} />
                {type.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${ids}-meter`} className="mb-2 block text-sm font-medium">Meter number</label>
          <input
            id={`${ids}-meter`}
            className={`${field} tabular-nums`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={13}
            value={meter}
            onChange={(e) => setMeter(e.target.value.replace(/\D/g, "").slice(0, 13))}
            placeholder="e.g. 45120987654"
          />
        </div>

        <div>
          <label htmlFor={`${ids}-amount`} className="mb-2 block text-sm font-medium">Amount (₦)</label>
          <input
            id={`${ids}-amount`}
            className={`${field} tabular-nums`}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
            placeholder={disco ? `${disco.min} – ${disco.max}` : ""}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.filter((q) => disco && q >= disco.min && q <= disco.max).map((q) => (
              <button key={q} type="button" onClick={() => setAmount(String(q))} className="rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10">
                {formatNaira(q).replace(".00", "")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={`${ids}-phone`} className="mb-2 block text-sm font-medium">Phone number</label>
          <input
            id={`${ids}-phone`}
            className={`${field} tabular-nums`}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={groupPhone(phone)}
            onChange={(e) => setPhone(normalizePhone(e.target.value))}
            placeholder="0803 123 4567"
          />
          <p className="mt-2 text-xs text-gray-600 dark:text-[#9FB3B7]">Your token and receipt are sent here.</p>
        </div>

        {price !== null && disco && (
          <p className="text-sm">
            You pay <span className="font-semibold tabular-nums">{formatNaira(price)}</span>
            {disco.discount > 0 && <span className="text-gray-600 dark:text-[#9FB3B7]"> ({disco.discount}% off)</span>}
          </p>
        )}

        {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}

        <button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-[#F2B632] text-base font-semibold text-[#12343B] outline-none transition-colors hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Processing…" : "Pay for electricity"}
        </button>
      </form>
    </div>
  );
}
