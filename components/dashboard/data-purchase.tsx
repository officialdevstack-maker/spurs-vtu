"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Tabs } from "@/components/admin/tabs";
import { Field, FormError, Modal, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import type { CatalogNetwork, PurchaseResult } from "@/lib/data-purchase";
import { formatNaira } from "@/lib/format";
import { PHONE_PATTERN, groupPhone, normalizePhone } from "@/lib/phone";
import { purchaseData } from "@/app/dashboard/data/actions";

type Errors = { plan?: string; phone?: string };

const card = (selected: boolean) =>
  `cursor-pointer rounded-xl border transition-colors focus-within:ring-2 focus-within:ring-[#12343B] dark:focus-within:ring-[#F2B632] ${
    selected
      ? "border-[#12343B] bg-gray-100 dark:border-[#F2B632] dark:bg-white/10"
      : "border-gray-300 hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/5"
  }`;

export function DataPurchase({
  networks,
  balance,
  defaultPhone,
}: {
  networks: CatalogNetwork[];
  balance: number | null;
  defaultPhone?: string;
}) {
  const router = useRouter();
  const base = useId();
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? "");
  const [typeId, setTypeId] = useState("");
  const [planId, setPlanId] = useState("");
  const [phone, setPhone] = useState(normalizePhone(defaultPhone ?? ""));
  const [errors, setErrors] = useState<Errors>({});
  const [confirming, setConfirming] = useState(false);
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [pending, startTransition] = useTransition();

  const network = networks.find((item) => item.id === networkId) ?? networks[0];
  const types = network?.types ?? [];
  const activeType = types.some((type) => type.id === typeId) ? typeId : (types[0]?.id ?? "");
  const plans = network ? network.plans.filter((plan) => plan.typeId === activeType) : [];
  const selected = plans.find((plan) => plan.id === planId) ?? null;
  const typeLabel = types.find((type) => type.id === activeType)?.label ?? "";
  const short = selected !== null && balance !== null && selected.price > balance;

  function chooseNetwork(id: string) {
    setNetworkId(id);
    setPlanId("");
    setErrors((previous) => ({ ...previous, plan: undefined }));
  }

  function chooseType(id: string) {
    setTypeId(id);
    setPlanId("");
  }

  function review() {
    const next: Errors = {};
    if (!selected) next.plan = "Choose a data plan.";
    if (!PHONE_PATTERN.test(phone)) next.phone = "Enter the 11-digit phone number, like 0803 123 4567.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setReference(crypto.randomUUID());
    setResult(null);
    setConfirming(true);
  }

  function pay() {
    if (pending || !selected) return;
    startTransition(async () => {
      try {
        setResult(await purchaseData({ planId: selected.id, phone, reference }));
      } catch (cause) {
        console.error("[data-purchase] Request failed", cause);
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
      if (result.ok) setPlanId("");
      router.refresh();
    }
  }

  if (!network) return null;

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

      <section aria-labelledby={`${base}-plans`}>
        <h2 id={`${base}-plans`} className="mb-3 text-sm font-medium">
          Data plan
        </h2>
        <Tabs
          label="Data type"
          tabs={types.map((type) => ({ id: type.id, label: type.label }))}
          value={activeType}
          onChange={chooseType}
          variant="pill"
        >
          <fieldset>
            <legend className="sr-only">
              {network.name} {typeLabel} plans
            </legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {plans.map((plan) => (
                <label key={plan.id} className={`flex flex-col gap-1 p-4 ${card(plan.id === selected?.id)}`}>
                  <input
                    type="radio"
                    name={`${base}-plan`}
                    value={plan.id}
                    checked={plan.id === selected?.id}
                    onChange={() => {
                      setPlanId(plan.id);
                      setErrors((previous) => ({ ...previous, plan: undefined }));
                    }}
                    className="sr-only"
                  />
                  <span className="font-[family-name:var(--font-display)] text-xl font-bold">{plan.size}</span>
                  <span className="text-sm text-gray-600 dark:text-[#9FB3B7]">{plan.validity}</span>
                  <span className="mt-2 font-semibold tabular-nums">{formatNaira(plan.price)}</span>
                  {plan.price < plan.standardPrice && (
                    <span className="text-xs text-gray-600 line-through tabular-nums dark:text-[#9FB3B7]">
                      <span className="sr-only">Standard price </span>
                      {formatNaira(plan.standardPrice)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        </Tabs>
        {errors.plan && (
          <p role="alert" className="mt-3 text-sm text-[#C8432B]">
            {errors.plan}
          </p>
        )}
      </section>

      <Field id={`${base}-phone`} label="Phone number" hint="The number that receives the data." error={errors.phone}>
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

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-100 p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">You pay</p>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">
            {selected ? formatNaira(selected.price) : "—"}
          </p>
        </div>
        {balance !== null && (
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">Wallet balance: {formatNaira(balance)}</p>
        )}
        {short && (
          <p role="alert" className="text-sm text-[#C8432B]">
            Your balance is too low for this plan.{" "}
            <Link href="/fund-wallet" className="font-semibold underline underline-offset-4">
              Fund wallet
            </Link>
          </p>
        )}
        <button type="button" onClick={review} disabled={short} className={`${btnPrimary} w-full`}>
          Review purchase
        </button>
      </div>

      {confirming && selected && (
        <Modal
          title={
            !result ? "Confirm purchase" : result.ok ? (result.status === "success" ? "Data sent" : "Processing") : "Purchase failed"
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
                  <dt className="text-gray-600 dark:text-[#9FB3B7]">Plan</dt>
                  <dd className="text-right font-medium">
                    {selected.size} {network.name} {typeLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600 dark:text-[#9FB3B7]">Validity</dt>
                  <dd className="font-medium">{selected.validity}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600 dark:text-[#9FB3B7]">Number</dt>
                  <dd className="font-medium tabular-nums">{groupPhone(phone)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-gray-200 pt-3 dark:border-white/10">
                  <dt className="text-gray-600 dark:text-[#9FB3B7]">You pay</dt>
                  <dd className="font-semibold tabular-nums">{formatNaira(selected.price)}</dd>
                </div>
                {balance !== null && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-600 dark:text-[#9FB3B7]">Balance after</dt>
                    <dd className="tabular-nums">{formatNaira(balance - selected.price)}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={close} disabled={pending} className={btnGhost}>
                  Cancel
                </button>
                <button type="button" onClick={pay} disabled={pending} className={btnPrimary}>
                  {pending ? "Buying…" : `Pay ${formatNaira(selected.price)}`}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
