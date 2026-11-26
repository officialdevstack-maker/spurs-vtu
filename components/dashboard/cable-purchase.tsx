"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { checkSmartcard, purchaseCable, type SmartcardCheckResult } from "@/app/dashboard/cable/actions";
import { SMARTCARD_PATTERN, type CableCatalogOperator } from "@/lib/cable-purchase";
import { formatNaira } from "@/lib/format";
import { PHONE_PATTERN, groupPhone, normalizePhone } from "@/lib/phone";
import { PinDialog } from "@/components/dashboard/pin-dialog";
import { PromoCodeField } from "@/components/dashboard/promo-code-field";
import type { PromoPreview } from "@/app/dashboard/promo-actions";

type Check = { status: "idle" } | { status: "checking" } | SmartcardCheckResult;
const IDLE: Check = { status: "idle" };

const input =
  "h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B] dark:focus-visible:ring-[#F2B632]";

export function CablePurchase({
  operators,
  balance,
  cashback,
  canVerify,
  defaultPhone,
  defaultUseCashback,
  confirmPurchases,
  pinRequired,
}: {
  operators: CableCatalogOperator[];
  balance: number | null;
  cashback: number;
  canVerify: boolean;
  defaultPhone?: string;
  defaultUseCashback: boolean;
  confirmPurchases: boolean;
  pinRequired: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [operatorId, setOperatorId] = useState(operators[0].id);
  const [planId, setPlanId] = useState("");
  const [smartcard, setSmartcard] = useState("");
  const [phone, setPhone] = useState(normalizePhone(defaultPhone ?? ""));
  const [useCashback, setUseCashback] = useState(defaultUseCashback);
  const [error, setError] = useState("");
  const [check, setCheck] = useState<Check>(IDLE);
  const reference = useRef<string>(crypto.randomUUID());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function scheduleCheck(card: string, op: string) {
    clearTimeout(timer.current);
    const id = ++seq.current;
    if (!canVerify || !SMARTCARD_PATTERN.test(card)) {
      setCheck(IDLE);
      return;
    }
    setCheck({ status: "checking" });
    timer.current = setTimeout(async () => {
      try {
        const result = await checkSmartcard({ operatorId: op, smartcard: card });
        if (id === seq.current) setCheck(result);
      } catch {
        if (id === seq.current) setCheck({ status: "unavailable" });
      }
    }, 600);
  }

  const operator = operators.find((o) => o.id === operatorId) ?? operators[0];
  const plan = operator.plans.find((p) => p.id === planId);
  const finalPrice = promoPreview?.ok ? promoPreview.finalPrice : plan?.price ?? null;
  const cashbackApplied = finalPrice !== null && useCashback ? Math.min(cashback, finalPrice) : 0;
  const walletPart = finalPrice === null ? 0 : finalPrice - cashbackApplied;
  const tooLow = !!plan && balance !== null && balance < walletPart;
  const verified = !canVerify || check.status === "found" || check.status === "unavailable";
  const ready = !!plan && SMARTCARD_PATTERN.test(smartcard) && PHONE_PATTERN.test(phone) && verified && !tooLow;

  function submit(pin?: string) {
    if (!plan || pending) return;
    if (pin === undefined && confirmPurchases && !window.confirm(`Buy ${plan.name} for ${formatNaira(walletPart)}?`)) return;
    setError("");
    startTransition(async () => {
      const result = await purchaseCable({ planId: plan.id, smartcard, phone, reference: reference.current, useCashback, promoCode, pin });
      if (!result.ok && result.pin) {
        setPinError(result.error);
        return;
      }
      setPinOpen(false);
      reference.current = crypto.randomUUID();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.status === "success") toast.success(result.message);
      else toast.info(result.message);
      seq.current++;
      setPlanId("");
      setSmartcard("");
      setCheck(IDLE);
      setUseCashback(false);
      router.refresh();
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div role="tablist" aria-label="Operator" className="flex flex-wrap gap-2">
        {operators.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={o.id === operatorId}
            onClick={() => {
              setOperatorId(o.id);
              setPlanId("");
              scheduleCheck(smartcard, o.id);
            }}
            className={`h-10 rounded-xl border px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632] ${
              o.id === operatorId
                ? "border-[#12343B] bg-[#12343B] text-white dark:border-[#F2B632] dark:bg-[#F2B632] dark:text-[#12343B]"
                : "border-gray-300 hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10"
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Bouquet</legend>
        <ul className="grid gap-3 sm:grid-cols-2">
          {operator.plans.map((p) => (
            <li key={p.id}>
              <label
                className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 ${
                  p.id === planId
                    ? "border-[#12343B] ring-1 ring-[#12343B] dark:border-[#F2B632] dark:ring-[#F2B632]"
                    : "border-gray-200 dark:border-white/10"
                } bg-white dark:bg-white/5`}
              >
                <input type="radio" name="plan" value={p.id} checked={p.id === planId} onChange={() => setPlanId(p.id)} className="sr-only" />
                <span>
                  <span className="block font-semibold">{p.name}</span>
                  <span className="mt-0.5 block text-xs text-gray-600 dark:text-[#9FB3B7]">{p.validity}</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums">{formatNaira(p.price)}</span>
                  {p.price < p.standardPrice && (
                    <span className="block text-xs text-gray-500 line-through tabular-nums">{formatNaira(p.standardPrice)}</span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div>
        <label htmlFor="smartcard" className="mb-2 block text-sm font-medium">Decoder / smartcard number</label>
        <input
          id="smartcard"
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          value={smartcard}
          aria-describedby="smartcard-check"
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 11);
            setSmartcard(next);
            scheduleCheck(next, operatorId);
          }}
          className={input}
        />
        <div id="smartcard-check" aria-live="polite" className="mt-2 min-h-5 text-sm">
          {check.status === "checking" && <p className="text-gray-600 dark:text-[#9FB3B7]">Checking decoder…</p>}
          {check.status === "found" && (
            <p className="rounded-xl border border-[#1E8E4F]/40 bg-[#E6F4EC] px-4 py-3 text-[#14693A] dark:bg-[#4CC38A]/10 dark:text-[#4CC38A]">
              <span className="block text-xs">Decoder owner</span>
              <span className="font-semibold">{check.name}</span>
              <span className="block text-xs">Not who you expected? Check the number before you pay.</span>
            </p>
          )}
          {check.status === "invalid" && (
            <p role="alert" className="text-[#C8432B]">We couldn&apos;t find that decoder number for {operator.name}. Check it and try again.</p>
          )}
          {check.status === "unavailable" && (
            <p className="text-gray-600 dark:text-[#9FB3B7]">
              We couldn&apos;t check this number. Double-check it before you pay.{" "}
              <button type="button" onClick={() => scheduleCheck(smartcard, operatorId)} className="font-semibold underline underline-offset-4">
                Try again
              </button>
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="cable-phone" className="mb-2 block text-sm font-medium">Phone number</label>
        <input
          id="cable-phone"
          type="tel"
          inputMode="numeric"
          placeholder="0803 123 4567"
          value={groupPhone(phone)}
          onChange={(e) => setPhone(normalizePhone(e.target.value))}
          className={input}
        />
      </div>

      <PromoCodeField
        service="cable"
        price={plan?.price ?? null}
        onChange={(code, final, preview) => {
          setPromoCode(code);
          setPromoPreview(preview);
        }}
      />

      {cashback > 0 && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={useCashback} onChange={(e) => setUseCashback(e.target.checked)} className="size-4" />
          Use cashback ({formatNaira(cashback)} available)
        </label>
      )}

      {plan && (
        <dl className="space-y-2 rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex justify-between"><dt className="text-gray-600 dark:text-[#9FB3B7]">Price</dt><dd className="tabular-nums">{formatNaira(finalPrice ?? plan.price)}</dd></div>
          {cashbackApplied > 0 && (
            <div className="flex justify-between"><dt className="text-gray-600 dark:text-[#9FB3B7]">Cashback</dt><dd className="tabular-nums">−{formatNaira(cashbackApplied)}</dd></div>
          )}
          <div className="flex justify-between font-semibold"><dt>From wallet</dt><dd className="tabular-nums">{formatNaira(walletPart)}</dd></div>
          {balance !== null && (
            <div className="flex justify-between"><dt className="text-gray-600 dark:text-[#9FB3B7]">Wallet balance</dt><dd className="tabular-nums">{formatNaira(balance)}</dd></div>
          )}
        </dl>
      )}

      {tooLow && (
        <p role="alert" className="text-sm text-[#C8432B]">
          Your wallet balance is too low. <a href="/fund-wallet" className="font-semibold underline underline-offset-4">Fund your wallet</a>.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}

      <button
        type="button"
        disabled={!ready || pending}
        onClick={() => {
          if (!plan) return;
          if (confirmPurchases && !window.confirm(`Buy ${plan.name} for ${formatNaira(walletPart)}?`)) return;
          if (pinRequired) {
            setPinError(null);
            setPinOpen(true);
          } else submit();
        }}
        className="h-12 w-full rounded-xl bg-[#F2B632] text-base font-semibold text-[#12343B] outline-none transition-colors hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Processing…" : plan ? `Pay ${formatNaira(walletPart)}` : "Choose a bouquet"}
      </button>
      <PinDialog open={pinOpen} pending={pending} error={pinError} onSubmit={(pin) => submit(pin)} onCancel={() => setPinOpen(false)} />
    </div>
  );
}
