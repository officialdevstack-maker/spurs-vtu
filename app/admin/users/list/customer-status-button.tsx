"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, btnDanger, btnGhost, btnPrimary } from "@/components/admin/modal";
import { setCustomerStatusAction } from "./actions";
import type { CustomerStatus } from "@/lib/db/customers";

export function CustomerStatusButton({
  customerId,
  customerName,
  status,
}: {
  customerId: string;
  customerName: string;
  status: CustomerStatus;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const nextStatus: CustomerStatus = status === "active" ? "suspended" : "active";
  const isSuspending = nextStatus === "suspended";

  function save() {
    setError("");
    startTransition(async () => {
      try {
        const result = await setCustomerStatusAction(customerId, nextStatus);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError("Could not update the customer status. Please try again.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={status === "active" ? btnGhost : btnPrimary}
      >
        {status === "active" ? "Suspend" : "Reactivate"}
      </button>
      {open ? (
        <Modal
          title={isSuspending ? "Suspend customer?" : "Reactivate customer?"}
          onClose={() => {
            if (!isPending) setOpen(false);
          }}
        >
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            {isSuspending
              ? `Mark ${customerName} as suspended in customer management? This status is currently informational and does not block sign-in, purchases or wallet funding.`
              : `Mark ${customerName} as active in customer management?`}
          </p>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-[#C8432B]">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={isPending} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={isSuspending ? btnDanger : btnPrimary}
              disabled={isPending}
              onClick={save}
            >
              {isPending ? "Saving..." : isSuspending ? "Suspend customer" : "Reactivate customer"}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
