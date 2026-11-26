"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustCashback } from "@/app/admin/products/cashback/activity/actions";

const field =
  "h-11 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]";

export function AdjustCashbackForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await adjustCashback({ customer, direction, amount: Number(amount), note });
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      setCustomer("");
      setAmount("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <h2 className="font-semibold">Adjust a customer&apos;s cashback</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="adj-customer" className="mb-1 block text-sm font-medium">Customer</label>
          <input id="adj-customer" className={field} placeholder="Username, email, phone or Spurs ID" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="adj-dir" className="mb-1 block text-sm font-medium">Action</label>
            <select id="adj-dir" className={field} value={direction} onChange={(e) => setDirection(e.target.value as "credit" | "debit")}>
              <option value="credit">Add</option>
              <option value="debit">Remove</option>
            </select>
          </div>
          <div>
            <label htmlFor="adj-amount" className="mb-1 block text-sm font-medium">Amount (₦)</label>
            <input id="adj-amount" inputMode="decimal" className={field} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="adj-note" className="mb-1 block text-sm font-medium">Reason</label>
        <input id="adj-note" className={field} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
      <button
        type="button"
        disabled={pending || !customer || !amount || !note}
        onClick={submit}
        className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] hover:bg-[#E5A720] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Apply"}
      </button>
    </section>
  );
}
