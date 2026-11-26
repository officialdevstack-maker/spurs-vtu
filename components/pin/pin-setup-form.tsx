"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resetPinAction, setupPin } from "@/app/pin/actions";
import { PinField } from "@/components/pin/pin-field";

export function PinSetupForm({ token }: { token?: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pin.length !== 4) {
      toast.error("Enter a 4-digit PIN.");
      return;
    }
    if (pin !== confirm) {
      toast.error("The two PINs don't match.");
      return;
    }
    start(async () => {
      try {
        const result = token ? await resetPinAction(token, pin) : await setupPin(pin);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(token ? "PIN reset" : "PIN set");
        router.replace(token ? "/dashboard/profile" : "/dashboard");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PinField label="New PIN" value={pin} onChange={setPin} autoFocus />
      <PinField label="Confirm PIN" value={confirm} onChange={setConfirm} />
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl bg-[#12343B] text-sm font-semibold text-white outline-none hover:bg-[#0C2429] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 disabled:opacity-60 dark:bg-[#F2B632] dark:text-[#12343B] dark:hover:bg-[#E5A720]"
      >
        {pending ? "Saving..." : token ? "Reset PIN" : "Set PIN"}
      </button>
    </form>
  );
}
