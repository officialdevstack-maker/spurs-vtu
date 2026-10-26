"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Tabs } from "@/components/admin/tabs";
import { Field, FormError, Modal, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import { NetworkCheck } from "@/components/dashboard/network-check";
import { QUICK_AMOUNTS, airtimePrice, findRange, type AirtimeCatalogNetwork } from "@/lib/airtime-purchase";
import type { PurchaseResult } from "@/lib/data-purchase";
import { formatNaira } from "@/lib/format";
import { checkNetwork } from "@/lib/network-prefix";
import { PHONE_PATTERN, groupPhone, normalizePhone } from "@/lib/phone";
import { purchaseAirtime } from "@/app/dashboard/airtime/actions";

type Errors = { amount?: string; phone?: string };

const card = (selected: boolean) =>
  `cursor-pointer rounded-xl border transition-colors focus-within:ring-2 focus-within:ring-[#12343B] dark:focus-within:ring-[#F2B632] ${
    selected
      ? "border-[#12343B] bg-gray-100 dark:border-[#F2B632] dark:bg-white/10"
      : "border-gray-300 hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/5"
  }`;

export function AirtimePurchase({
  networks,
  balance,
  defaultPhone,
}: {
  networks: AirtimeCatalogNetwork[];
  balance: number | null;
  defaultPhone?: string;
}) {
  const router = useRouter();
  const base = useId();
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? "");
  const [typeId, setTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(normalizePhone(defaultPhone ?? ""));
  const [errors, setErrors] = useState<Errors>({});
  const [bypassKey, setBypassKey] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [pending, startTransition] = useTransition();

  const network = networks.find((item) => item.id === networkId) ?? networks[0];
  const types = network?.types ?? [];
  const activeType = types.find((type) => type.id === typeId) ?? types[0];
  const ranges = activeType?.ranges ?? [];
  const typeLabel = activeType?.label ?? "";

  const amountValue = amount === "" ? Number.NaN : Number(amount);
  const range = Number.isInteger(amountValue) ? findRange(ranges, amountValue) : null;
  const price = range ? airtimePrice(amountValue, range.discount) : null;
  const saving = price !== null ? amountValue - price : 0;
  const short = price !== null && balance !== null && price > balance;
  const lowest = ranges.length ? Math.min(...ranges.map((item) => item.min)) : 0;
  const highest = ranges.length ? Math.max(...ranges.map((item) => item.max)) : 0;
  const quick = QUICK_AMOUNTS.filter((value) => findRange(ranges, value));
  const checkKey = `${phone}:${network?.id ?? ""}`;
  const skipCheck = bypassKey === checkKey;
  const mismatch = checkNetwork(phone, network?.id ?? "").status === "mismatch";

  function chooseNetwork(id: string) {
    setNetworkId(id);
    setBypassKey("");
    setErrors((previous) => ({ ...previous, amount: undefined }));
  }

  function chooseType(id: string) {
    setTypeId(id);
    setErrors((previous) => ({ ...previous, amount: undefined }));
  }

  function setAmountText(value: string) {
    setAmount(value.replace(/\D/g, "").slice(0, 7));
    setErrors((previous) => ({ ...previous, amount: undefined }));
  }

  function review() {
    const next: Errors = {};
    if (amount === "" || !Number.isInteger(amountValue) || amountValue <= 0) {
      next.amount = "Enter the amount of airtime you want.";
    } else if (!range) {
      next.amount =
        amountValue < lowest || amountValue > highest
          ? `Enter an amount from ${formatNaira(lowest)} to ${formatNaira(highest)}.`
          : "That amount isn't available. Try a different one.";
    }
    if (!PHONE_PATTERN.test(phone)) {
      next.phone = "Enter the 11-digit phone number, like 0803 123 4567.";
    } else if (mismatch && !skipCheck) {
      next.phone = `That number doesn't look like a ${network.name} number. Switch network, or tick the box below to continue.`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setReference(crypto.randomUUID());
    setResult(null);
    setConfirming(true);
  }

  function pay() {
    if (pending || !network || !activeType || !range) return;
    startTransition(async () => {
      try {
        setResult(
          await purchaseAirtime({
            networkId: network.id,
            typeId: activeType.id,
            amount: amountValue,
            phone,
            reference,
            skipNetworkCheck: skipCheck,
          }),
        );
      } catch (cause) {
        console.error("[airtime-purchase] Request failed", cause);
        setResult({
          ok: false,
          error: "We couldn't confirm the purchase. Check your history and wallet before trying again.",
        });
      }
    });
  }

  function close() {
    if (pending) return;
    setConfirming(false);
    if (result) {
      if (result.ok) setAmount("");
      router.refresh();
    }
  }

  if (!network || !activeType) return null;

  const amountSection = (
    <div className="space-y-4">
      {quick.length > 0 && (
        <div role="group" aria-label="Quick amounts" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {quick.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmountText(String(value))}
              aria-pressed={amountValue === value}
              className={`px-3 py-3 text-sm font-semibold tabular-nums outline-none ${card(amountValue === value)}`}
            >
              {formatNaira(value).replace(".00", "")}
            </button>
          ))}
        </div>
      )}

      <Field
        id={`${base}-amount`}
        label="Amount (₦)"
        hint={
          range && price !== null
            ? `You pay ${formatNaira(price)} (${range.discount}% off).`
            : `From ${formatNaira(lowest)} to ${formatNaira(highest)}.`
        }
        error={errors.amount}
      >
        <input
          id={`${base}-amount`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="500"
          value={amount}
          onChange={(event) => setAmountText(event.target.value)}
          aria-invalid={!!errors.amount}
          aria-describedby={`${base}-amount-note`}
          className={`${inputClass(!!errors.amount)} tabular-nums`}
        />
      </Field>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-medium">Network</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {networks.map((item) => (
            <label
              key={item.id}
              className={`flex items-center justify-center px-4 py-3 text-sm font-semibold ${card(item.id === network.id)}`}
            >
              <input
                type="radio"
                name={`${base}-network`}
                value={item.id}
                checked={item.id === network.id}
                onChange={() => chooseNetwork(item.id)}
                className="sr-only"
              />
              {item.name}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby={`${base}-amount-heading`}>
        <h2 id={`${base}-amount-heading`} className="mb-3 text-sm font-medium">
          Airtime
        </h2>
        {types.length > 1 ? (
          <Tabs
            label="Airtime type"
            tabs={types.map((type) => ({ id: type.id, label: type.label }))}
            value={activeType.id}
            onChange={chooseType}
            variant="pill"
          >
            {amountSection}
          </Tabs>
        ) : (
          amountSection
        )}
      </section>

      <Field id={`${base}-phone`} label="Phone number" hint="The number that receives the airtime." error={errors.phone}>
        <input
          id={`${base}-phone`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="0803 123 4567"
          value={groupPhone(phone)}
          onChange={(event) => {
            setPhone(normalizePhone(event.target.value));
            if (errors.phone) setErrors((previous) => ({ ...previous, phone: undefined }));
          }}
          aria-invalid={!!errors.phone}
          aria-describedby={`${base}-phone-note`}
          className={`${inputClass(!!errors.phone)} tabular-nums`}
        />
      </Field>

      <NetworkCheck
        phone={phone}
        networkId={network.id}
        networkName={network.name}
        available={networks}
        bypass={skipCheck}
        onBypass={(next) => setBypassKey(next ? checkKey : "")}
        onSwitch={(id) => {
          chooseNetwork(id);
          setBypassKey("");
        }}
      />

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-100 p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">You pay</p>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">
            {price !== null ? formatNaira(price) : "—"}
          </p>
        </div>
        {price !== null && saving > 0 && (
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            You get {formatNaira(amountValue)} of airtime and save {formatNaira(saving)}.
          </p>
        )}
        {balance !== null && (
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">Wallet balance: {formatNaira(balance)}</p>
        )}
        {short && (
          <p role="alert" className="text-sm text-[#C8432B]">
            Your balance is too low for this amount.{" "}
            <Link href="/fund-wallet" className="font-semibold underline underline-offset-4">
              Fund wallet
            </Link>
          </p>
        )}
        <button type="button" onClick={review} disabled={short} className={`${btnPrimary} w-full`}>
          Review purchase
        </button>
      </div>

      {confirming && range && price !== null && (
        <Modal
          title={
            !result
              ? "Confirm purchase"
              : result.ok
                ? result.status === "success"
                  ? "Airtime sent"
                  : "Processing"
                : "Purchase failed"
          }
          onClose={close}
        >
          {result ? (
            <>
              {result.ok ? (
                <p
                  role="status"
                  className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5"
                >
                  {result.message}
                </p>
              ) : (
                <FormError>{result.error}</FormError>
              )}
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={close} className={btnPrimary}>
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600 dark:text-[#9FB3B7]">Airtime</dt>
                  <dd className="text-right font-medium">
                    {formatNaira(amountValue)} {network.name} {typeLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600 dark:text-[#9FB3B7]">Number</dt>
                  <dd className="font-medium tabular-nums">{groupPhone(phone)}</dd>
                </div>
                {saving > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-600 dark:text-[#9FB3B7]">Discount ({range.discount}%)</dt>
                    <dd className="tabular-nums">−{formatNaira(saving)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 border-t border-gray-200 pt-3 dark:border-white/10">
                  <dt className="text-gray-600 dark:text-[#9FB3B7]">You pay</dt>
                  <dd className="font-semibold tabular-nums">{formatNaira(price)}</dd>
                </div>
                {balance !== null && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-600 dark:text-[#9FB3B7]">Balance after</dt>
                    <dd className="tabular-nums">{formatNaira(balance - price)}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={close} disabled={pending} className={btnGhost}>
                  Cancel
                </button>
                <button type="button" onClick={pay} disabled={pending} className={btnPrimary}>
                  {pending ? "Buying…" : `Pay ${formatNaira(price)}`}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
