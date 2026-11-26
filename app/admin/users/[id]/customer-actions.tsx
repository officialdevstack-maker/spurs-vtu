"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import {
  adjustCustomerCashback,
  adjustWallet,
  changePackageForCustomer,
  resetCustomerPin,
  toggleFraudExempt,
  type CustomerActionResult,
} from "./actions";

type Dialog = "wallet" | "cashback" | "package" | "pin" | "exempt" | null;

export function CustomerActions({
  customerId,
  packages,
  currentPackageId,
  fraudExempt,
  hasPin,
  canManage,
  canAdjust,
  isSelf,
}: {
  customerId: string;
  packages: { id: string; name: string }[];
  currentPackageId: string;
  fraudExempt: boolean;
  hasPin: boolean;
  canManage: boolean;
  canAdjust: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Dialog>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [packageId, setPackageId] = useState(currentPackageId);

  function close() {
    if (pending) return;
    setOpen(null);
    setError("");
    setAmount("");
    setNote("");
    setDirection("credit");
    setPackageId(currentPackageId);
  }

  function run(action: () => Promise<CustomerActionResult>) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setNotice(result.message);
        setOpen(null);
        setAmount("");
        setNote("");
        router.refresh();
      } catch {
        setError("Could not complete that. Please try again.");
      }
    });
  }

  const adjustment = () => ({ direction, amount: Number(amount), note });
  const money = open === "wallet" || open === "cashback";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canAdjust && !isSelf && (
          <button type="button" className={btnPrimary} onClick={() => setOpen("wallet")}>Adjust wallet</button>
        )}
        {canAdjust && (
          <button type="button" className={btnGhost} onClick={() => setOpen("cashback")}>Adjust cashback</button>
        )}
        {canManage && (
          <button type="button" className={btnGhost} onClick={() => setOpen("package")}>Change package</button>
        )}
        {canManage && hasPin && (
          <button type="button" className={btnGhost} onClick={() => setOpen("pin")}>Reset PIN</button>
        )}
        {canAdjust && (
          <button type="button" className={btnGhost} onClick={() => setOpen("exempt")}>
            {fraudExempt ? "Apply fraud checks" : "Exempt from fraud checks"}
          </button>
        )}
      </div>
      {notice && !open && <p role="status" className="mt-3 text-sm text-[#1E8E4F] dark:text-[#4CC38A]">{notice}</p>}

      {money && (
        <Modal title={open === "wallet" ? "Adjust wallet" : "Adjust cashback"} onClose={close}>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Action</span>
              <select className={inputClass()} value={direction} onChange={(e) => setDirection(e.target.value as "credit" | "debit")}>
                <option value="credit">Add</option>
                <option value="debit">Remove</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Amount (₦)</span>
              <input className={inputClass()} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Reason</span>
              <textarea className={inputClass()} rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
              <span className="mt-1 block text-xs text-gray-600 dark:text-[#9FB3B7]">Saved in the audit log.</span>
            </label>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-[#C8432B]">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={pending} onClick={close}>Cancel</button>
            <button
              type="button"
              className={direction === "debit" ? btnDanger : btnPrimary}
              disabled={pending}
              onClick={() => run(() => (open === "wallet" ? adjustWallet(customerId, adjustment()) : adjustCustomerCashback(customerId, adjustment())))}
            >
              {pending ? "Saving..." : direction === "debit" ? "Remove" : "Add"}
            </button>
          </div>
        </Modal>
      )}

      {open === "package" && (
        <Modal title="Change package" onClose={close}>
          <p className="mb-4 text-sm text-gray-600 dark:text-[#9FB3B7]">No upgrade fee is charged when staff change a package.</p>
          <select className={inputClass()} value={packageId} onChange={(e) => setPackageId(e.target.value)}>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {error && <p role="alert" className="mt-4 text-sm text-[#C8432B]">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={pending} onClick={close}>Cancel</button>
            <button type="button" className={btnPrimary} disabled={pending || packageId === currentPackageId} onClick={() => run(() => changePackageForCustomer(customerId, packageId))}>
              {pending ? "Saving..." : "Change package"}
            </button>
          </div>
        </Modal>
      )}

      {open === "pin" && (
        <Modal title="Reset transaction PIN?" onClose={close}>
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            This removes the customer&apos;s PIN and any lockout. They will be asked to set a new one and are notified.
            Only do this after you&apos;ve confirmed who they are.
          </p>
          {error && <p role="alert" className="mt-4 text-sm text-[#C8432B]">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={pending} onClick={close}>Cancel</button>
            <button type="button" className={btnDanger} disabled={pending} onClick={() => run(() => resetCustomerPin(customerId))}>
              {pending ? "Resetting..." : "Reset PIN"}
            </button>
          </div>
        </Modal>
      )}

      {open === "exempt" && (
        <Modal title={fraudExempt ? "Apply fraud checks again?" : "Exempt from fraud checks?"} onClose={close}>
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            {fraudExempt
              ? "Their purchases will be screened by the fraud rules again."
              : "Their purchases will skip every fraud rule, including holds. Use this for trusted resellers only."}
          </p>
          {error && <p role="alert" className="mt-4 text-sm text-[#C8432B]">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={pending} onClick={close}>Cancel</button>
            <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => toggleFraudExempt(customerId, !fraudExempt))}>
              {pending ? "Saving..." : "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
