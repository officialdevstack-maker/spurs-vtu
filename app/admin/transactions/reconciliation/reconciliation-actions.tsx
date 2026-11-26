"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import {
  requeryItem,
  resolveLateSuccess,
  resolveStuck,
  type ReconResult,
} from "./actions";

type Props = {
  id: string;
  kind: "late_success" | "stuck_pending";
};

export function ReconciliationActions({ id, kind }: Props) {
  const [open, setOpen] = useState<"requery" | "recharge" | "write_off" | "success" | "failed" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function close() {
    if (!isPending) {
      setOpen(null);
      setReason("");
      setError("");
    }
  }

  function run(action: () => Promise<ReconResult>) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOpen(null);
        setReason("");
        router.refresh();
      } catch {
        setError("Could not complete that action. Please try again.");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={btnGhost} onClick={() => setOpen("requery")}>Requery</button>
        {kind === "late_success" ? (
          <>
            <button type="button" className={btnPrimary} onClick={() => setOpen("recharge")}>Re-charge</button>
            <button type="button" className={btnGhost} onClick={() => setOpen("write_off")}>Write off</button>
          </>
        ) : (
          <>
            <button type="button" className={btnPrimary} onClick={() => setOpen("success")}>Confirm success</button>
            <button type="button" className={btnDanger} onClick={() => setOpen("failed")}>Fail and refund</button>
          </>
        )}
      </div>
      {open ? (
        <Modal
          title={
            open === "requery" ? "Requery provider" :
            open === "recharge" ? "Re-charge customer?" :
            open === "write_off" ? "Write off late success?" :
            open === "success" ? "Confirm successful order?" : "Fail and refund order?"
          }
          onClose={close}
        >
          {open !== "requery" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Resolution reason</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={200}
                rows={3}
                className={inputClass()}
                placeholder="Explain why this resolution was chosen"
              />
            </label>
          ) : (
            <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
              Ask the provider for a current status. Unknown, pending and error replies will not settle the order.
            </p>
          )}
          {error ? <p role="alert" className="mt-4 text-sm text-[#C8432B]">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={isPending} onClick={close}>Cancel</button>
            {open === "requery" ? (
              <button type="button" className={btnPrimary} disabled={isPending} onClick={() => run(() => requeryItem(id))}>
                {isPending ? "Checking..." : "Requery"}
              </button>
            ) : kind === "late_success" ? (
              <button
                type="button"
                className={open === "recharge" ? btnPrimary : btnGhost}
                disabled={isPending}
                onClick={() => run(() => resolveLateSuccess(id, open === "recharge" ? "recharge" : "write_off", reason))}
              >
                {isPending ? "Saving..." : open === "recharge" ? "Re-charge customer" : "Write off"}
              </button>
            ) : (
              <button
                type="button"
                className={open === "success" ? btnPrimary : btnDanger}
                disabled={isPending}
                onClick={() => run(() => resolveStuck(id, open === "success" ? "success" : "failed", reason))}
              >
                {isPending ? "Saving..." : open === "success" ? "Confirm success" : "Fail and refund"}
              </button>
            )}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
