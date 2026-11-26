"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, btnDanger, btnGhost } from "@/components/admin/modal";
import { resetCustomerPin, setCustomerFraudExempt, type CustomerActionResult } from "./actions";

export function CustomerActions({
  customerId,
  name,
  hasPin,
  fraudExempt,
}: {
  customerId: string;
  name: string;
  hasPin: boolean;
  fraudExempt: boolean;
}) {
  const router = useRouter();
  const [confirmPin, setConfirmPin] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<CustomerActionResult>, done?: () => void) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) return setError(result.error);
        done?.();
        router.refresh();
      } catch {
        setError("Could not complete that. Please try again.");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnGhost} disabled={!hasPin || pending} onClick={() => setConfirmPin(true)}>
          Reset PIN
        </button>
        <button
          type="button"
          className={btnGhost}
          disabled={pending}
          onClick={() => run(() => setCustomerFraudExempt(customerId, !fraudExempt))}
        >
          {fraudExempt ? "Apply fraud checks" : "Exempt from fraud checks"}
        </button>
      </div>
      {error && !confirmPin ? (
        <p role="alert" className="mt-3 text-sm text-[#C8432B]">
          {error}
        </p>
      ) : null}

      {confirmPin ? (
        <Modal title="Reset transaction PIN?" onClose={() => !pending && setConfirmPin(false)}>
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            Remove {name}&apos;s PIN? They must set a new one before buying again, and they&apos;ll be notified.
          </p>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-[#C8432B]">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={pending} onClick={() => setConfirmPin(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={btnDanger}
              disabled={pending}
              onClick={() => run(() => resetCustomerPin(customerId), () => setConfirmPin(false))}
            >
              {pending ? "Resetting..." : "Reset PIN"}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
