"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError, Modal, btnGhost, btnPrimary } from "@/components/admin/modal";
import { formatNaira } from "@/lib/format";
import { upgradePackage } from "@/app/dashboard/packages/actions";

export function UpgradeButton({ packageId, name, fee }: { packageId: string; name: string; fee: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  function confirm() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await upgradePackage(packageId);
        if (result.ok) {
          toast.success(`You're now on ${name}`);
          setOpen(false);
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch (cause) {
        console.error("[packages] Failed to upgrade", cause);
        setError("Could not upgrade. Please try again.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btnPrimary} w-full`}>
        {fee > 0 ? `Upgrade for ${formatNaira(fee)}` : "Switch for free"}
      </button>

      {open && (
        <Modal title={`Upgrade to ${name}?`} onClose={close}>
          <p className="text-base text-gray-600 dark:text-[#9FB3B7]">
            {fee > 0
              ? `${formatNaira(fee)} will be taken from your wallet once. You'll get ${name} prices straight away.`
              : `You'll get ${name} prices straight away.`}
          </p>
          {error && (
            <div className="mt-4">
              <FormError>{error}</FormError>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={close} className={btnGhost}>
              Cancel
            </button>
            <button type="button" onClick={confirm} disabled={pending} className={btnPrimary}>
              {pending ? "Upgrading…" : fee > 0 ? `Pay ${formatNaira(fee)}` : "Switch for free"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
