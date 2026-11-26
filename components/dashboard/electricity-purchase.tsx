"use client";

import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock, TriangleAlert, Zap } from "lucide-react";
import { toast } from "sonner";
import { purchaseElectricity } from "@/app/dashboard/electricity/actions";
import type { PurchaseResult } from "@/lib/data-purchase";
import {
  METER_PATTERN,
  METER_TYPES,
  QUICK_AMOUNTS,
  electricityPrice,
  type ElectricityDisco,
  type MeterType,
} from "@/lib/electricity-purchase";
import { formatNaira, formatNumber } from "@/lib/format";
import { PHONE_PATTERN, groupPhone, normalizePhone } from "@/lib/phone";
import { CashbackToggle } from "@/components/dashboard/cashback-toggle";
import { MeterCheckNote, useMeterCheck } from "@/components/dashboard/meter-check";
import { PinDialog } from "@/components/dashboard/pin-dialog";
import { PromoCodeField } from "@/components/dashboard/promo-code-field";
import type { PromoPreview } from "@/app/dashboard/promo-actions";

const input =
  "h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition-colors placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:bg-[#10262B] dark:focus-visible:ring-[#F2B632]";
const inputOk = "border-gray-300 dark:border-white/15";
const inputBad = "border-[#C8432B]";
const select =
  "h-12 w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 pr-11 text-base font-medium outline-none transition-colors hover:border-[#12343B]/50 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B] dark:hover:border-[#F2B632]/50 dark:focus-visible:ring-[#F2B632]";

export function ElectricityPurchase({
  discos,
  balance,
  cashback,
  defaultPhone,
  canVerify,
  defaultUseCashback,
  confirmPurchases,
  pinRequired,
}: {
  discos: ElectricityDisco[];
  balance: number | null;
  cashback: number;
  defaultPhone?: string;
  canVerify: boolean;
  defaultUseCashback: boolean;
  confirmPurchases: boolean;
  pinRequired: boolean;
}) {
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [discoId, setDiscoId] = useState(discos[0]?.id ?? "");
  const [meterType, setMeterType] = useState<MeterType>("prepaid");
  const [meter, setMeter] = useState("");
  const [amountText, setAmountText] = useState("");
  const [phone, setPhone] = useState(normalizePhone(defaultPhone ?? ""));
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [reference, setReference] = useState(() => crypto.randomUUID());
  const [useCashback, setUseCashback] = useState(defaultUseCashback);
  const { check, schedule, reset, verified } = useMeterCheck(canVerify);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);

  const disco = useMemo(() => discos.find((item) => item.id === discoId) ?? discos[0], [discos, discoId]);
  const amount = amountText === "" ? NaN : Number(amountText);
  const amountError = !Number.isInteger(amount)
    ? "Enter a whole-naira amount."
    : amount < disco.min || amount > disco.max
      ? `Enter an amount from ₦${formatNumber(disco.min)} to ₦${formatNumber(disco.max)}.`
      : null;
  const meterError = METER_PATTERN.test(meter) ? null : "Enter your meter number, 10 to 13 digits.";
  const phoneError = PHONE_PATTERN.test(phone) ? null : "Enter an 11-digit phone number, like 0803 123 4567.";
  const price = amountError ? null : electricityPrice(amount, disco.discount);
  const saving = price === null ? null : Math.round((amount - price) * 100) / 100;
  const finalPrice = promoPreview?.ok ? promoPreview.finalPrice : price;
  const short = finalPrice !== null && balance !== null && balance < finalPrice;
  const walletPart = finalPrice === null ? 0 : Math.max(0, finalPrice - (useCashback ? Math.min(cashback, finalPrice) : 0));
  const shortWithCashback = price !== null && balance !== null && balance < walletPart;
  const hasPackageRate = disco.discount > disco.standardDiscount;
  const quickAmounts = QUICK_AMOUNTS.filter((value) => value >= disco.min && value <= disco.max);

  function submit(pin?: string) {
    setTouched(true);
    if (pending || amountError || meterError || phoneError || !verified || (useCashback ? shortWithCashback : short)) return;
    if (pin === undefined && confirmPurchases && !window.confirm(`Buy ₦${formatNumber(amount)} electricity for ${formatNaira(walletPart)}?`)) return;
    if (pin === undefined && pinRequired) {
      setPinError(null);
      setPinOpen(true);
      return;
    }
    startTransition(async () => {
      try {
        const outcome = await purchaseElectricity({
          discoId: disco.id,
          meterType,
          meter,
          amount,
          phone,
          reference,
          useCashback,
          promoCode,
          pin,
        });
        if (!outcome.ok && outcome.pin) {
          setPinError(outcome.error);
          setResult(outcome);
          return;
        }
        setPinOpen(false);
        setResult(outcome);
        setReference(crypto.randomUUID());
        if (outcome.ok && outcome.status === "success") {
          setMeter("");
          setAmountText("");
          setTouched(false);
          reset();
          toast.success("Electricity purchase complete.");
        } else if (!outcome.ok) {
          toast.error("Purchase failed.");
        }
      } catch {
        toast.error("We couldn't confirm that. Check your transactions before trying again.");
      }
    });
  }

  return (
    <div className="grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        noValidate
        className="space-y-6"
      >
        <div>
          <label htmlFor={`${ids}-disco`} className="mb-2 block text-sm font-medium">Distribution company</label>
          <div className="relative">
            <select
              id={`${ids}-disco`}
              value={disco.id}
              onChange={(event) => {
                setDiscoId(event.target.value);
                schedule(event.target.value, meterType, meter);
              }}
              className={select}
            >
              {discos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.discount > 0 ? `${item.discount}% off` : "No discount"}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500 dark:text-[#9FB3B7]" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4"><path fillRule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
            </span>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Meter type</legend>
          <div className="inline-flex rounded-xl border border-gray-300 p-1 dark:border-white/15">
            {METER_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                aria-pressed={meterType === type.id}
                onClick={() => {
                  setMeterType(type.id);
                  schedule(discoId, type.id, meter);
                }}
                className={`h-10 rounded-lg px-5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632] ${
                  meterType === type.id
                    ? "bg-[#12343B] text-white dark:bg-[#F2B632] dark:text-[#12343B]"
                    : "text-gray-600 hover:bg-gray-100 dark:text-[#9FB3B7] dark:hover:bg-white/10"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${ids}-meter`} className="mb-2 block text-sm font-medium">Meter number</label>
          <input
            id={`${ids}-meter`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 4512000987"
            value={meter}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "").slice(0, 13);
              setMeter(next);
              schedule(discoId, meterType, next);
            }}
            aria-invalid={touched && !!meterError}
            className={`${input} tabular-nums ${touched && meterError ? inputBad : inputOk}`}
          />
          <MeterCheckNote check={check} onRetry={() => schedule(discoId, meterType, meter)} />
          {touched && meterError && <p role="alert" className="mt-2 text-sm text-[#C8432B]">{meterError}</p>}
        </div>

        <div>
          <label htmlFor={`${ids}-amount`} className="mb-2 block text-sm font-medium">Amount (₦)</label>
          <input
            id={`${ids}-amount`}
            inputMode="numeric"
            autoComplete="off"
            placeholder={`${formatNumber(disco.min)} – ${formatNumber(disco.max)}`}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/\D/g, "").slice(0, 8))}
            aria-invalid={touched && !!amountError}
            className={`${input} tabular-nums ${touched && amountError ? inputBad : inputOk}`}
          />
          {quickAmounts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmountText(String(value))}
                  className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium tabular-nums outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:hover:bg-white/10 dark:focus-visible:ring-[#F2B632]"
                >
                  ₦{formatNumber(value)}
                </button>
              ))}
            </div>
          )}
          {touched && amountError && <p role="alert" className="mt-2 text-sm text-[#C8432B]">{amountError}</p>}
        </div>

        <div>
          <label htmlFor={`${ids}-phone`} className="mb-2 block text-sm font-medium">Phone number</label>
          <input
            id={`${ids}-phone`}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="0803 123 4567"
            value={groupPhone(phone)}
            onChange={(e) => setPhone(normalizePhone(e.target.value))}
            aria-invalid={touched && !!phoneError}
            className={`${input} tabular-nums ${touched && phoneError ? inputBad : inputOk}`}
          />
          <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">Your prepaid token can be sent here.</p>
          {touched && phoneError && <p role="alert" className="mt-2 text-sm text-[#C8432B]">{phoneError}</p>}
        </div>

        {price !== null && (
          <CashbackToggle
            balance={cashback}
            price={price}
            checked={useCashback}
            onChange={setUseCashback}
          />
        )}

        <PromoCodeField
          service="electricity"
          price={price}
          onChange={(code, final, preview) => {
            setPromoCode(code);
            setPromoPreview(preview);
          }}
        />

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#F2B632] text-base font-semibold text-[#12343B] outline-none transition-colors hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#0B1B1F]"
        >
          <Zap className="size-5" aria-hidden="true" />
          {pending ? "Processing..." : price !== null ? `Pay ${formatNaira(price)}` : "Pay"}
        </button>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Order summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-[#9FB3B7]">Disco</dt>
              <dd className="text-right font-medium">{disco.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-[#9FB3B7]">Meter</dt>
              <dd className="text-right font-medium tabular-nums">{meter || "—"} · {METER_TYPES.find((t) => t.id === meterType)?.label}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-[#9FB3B7]">Amount</dt>
              <dd className="font-medium tabular-nums">{amountError ? "—" : formatNaira(amount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-[#9FB3B7]">Discount</dt>
              <dd className="font-medium tabular-nums">{disco.discount}%{saving !== null && saving > 0 && ` (−${formatNaira(saving)})`}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-dashed border-gray-300 pt-3 text-base dark:border-white/15">
              <dt className="font-semibold">You pay</dt>
              <dd className="font-[family-name:var(--font-display)] text-xl font-bold tabular-nums">{price === null ? "—" : formatNaira(price)}</dd>
            </div>
            {useCashback && price !== null && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600 dark:text-[#9FB3B7]">Cashback</dt>
                  <dd className="font-medium tabular-nums">{formatNaira(Math.min(cashback, price))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600 dark:text-[#9FB3B7]">Wallet pays</dt>
                  <dd className="font-medium tabular-nums">{formatNaira(walletPart)}</dd>
                </div>
              </>
            )}
          </dl>
          {hasPackageRate && (
            <p className="mt-3 rounded-lg bg-[#E6F4EC] px-3 py-2 text-xs font-medium text-[#14693A] dark:bg-[#4CC38A]/15 dark:text-[#4CC38A]">
              Your package gets {disco.discount}% instead of the standard {disco.standardDiscount}%.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">Wallet balance</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">
            {balance === null ? "Unavailable" : formatNaira(balance)}
          </p>
          {(useCashback ? shortWithCashback : short) && (
            <p role="alert" className="mt-3 text-sm text-[#C8432B]">
              Your balance is lower than this order.{" "}
              <Link href="/fund-wallet" className="font-semibold underline underline-offset-4">Fund wallet</Link>
            </p>
          )}
        </section>

        {result && (
          <div
            role={result.ok ? "status" : "alert"}
            className={`flex gap-3 rounded-2xl border p-5 ${
              !result.ok
                ? "border-[#C8432B] bg-white dark:bg-white/5"
                : result.status === "success"
                  ? "border-[#1E8E4F]/40 bg-[#E6F4EC] dark:border-[#4CC38A]/30 dark:bg-[#4CC38A]/10"
                  : "border-[#F2B632]/60 bg-[#FFF8E1] dark:border-[#F2B632]/30 dark:bg-[#F2B632]/10"
            }`}
          >
            {!result.ok ? (
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-[#C8432B]" aria-hidden="true" />
            ) : result.status === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#1E8E4F] dark:text-[#4CC38A]" aria-hidden="true" />
            ) : (
              <Clock className="mt-0.5 size-5 shrink-0 text-[#7A5600] dark:text-[#F2B632]" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="font-semibold">
                {!result.ok ? "Purchase failed" : result.status === "success" ? "Payment complete" : "Waiting for confirmation"}
              </p>
              <p className="mt-1 break-words text-sm text-gray-700 dark:text-[#D5E0E2]">
                {result.ok ? result.message : result.error}
              </p>
              <Link href="/dashboard/transactions" className="mt-2 inline-block text-sm font-semibold underline underline-offset-4">
                View transactions
              </Link>
            </div>
          </div>
        )}
      </aside>
      <PinDialog open={pinOpen} pending={pending} error={pinError} onSubmit={(pin) => submit(pin)} onCancel={() => setPinOpen(false)} />
    </div>
  );
}
