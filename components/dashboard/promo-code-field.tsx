"use client";

import { useState, useTransition } from "react";
import { previewPromo, type PromoPreview } from "@/app/dashboard/promo-actions";
import { inputClass } from "@/components/admin/modal";
import { formatNaira } from "@/lib/format";
import type { PromoService } from "@/lib/admin/promotions";

export function PromoCodeField({
  service,
  price,
  onChange,
}: {
  service: PromoService;
  price: number | null;
  onChange: (code: string | null, finalPrice: number | null, preview: PromoPreview | null) => void;
}) {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<PromoPreview | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    if (price === null) return;
    startTransition(async () => {
      const result = await previewPromo({ code, service, price });
      setPreview(result);
      onChange(result.ok ? code.trim() : null, result.ok ? result.finalPrice : null, result);
    });
  }

  function clear() {
    setCode("");
    setPreview(null);
    onChange(null, null, null);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`promo-${service}`} className="block text-sm font-medium">Promo code <span className="font-normal text-gray-600 dark:text-[#9FB3B7]">(optional)</span></label>
      <div className="flex gap-2">
        <input
          id={`promo-${service}`}
          value={code}
          maxLength={40}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            setPreview(null);
            onChange(null, null, null);
          }}
          className={`${inputClass(!!preview && !preview.ok)} min-w-0 flex-1`}
          placeholder="Enter code"
        />
        {preview?.ok ? (
          <button type="button" onClick={clear} className="h-12 rounded-xl border border-gray-300 px-4 text-sm font-semibold dark:border-white/15">Remove</button>
        ) : (
          <button type="button" disabled={pending || !code.trim() || price === null} onClick={apply} className="h-12 rounded-xl bg-[#12343B] px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-[#F2B632] dark:text-[#12343B]">
            {pending ? "Checking…" : "Apply"}
          </button>
        )}
      </div>
      {preview && (
        <p role={preview.ok ? "status" : "alert"} className={`text-sm ${preview.ok ? "text-[#14693A] dark:text-[#4CC38A]" : "text-[#C8432B]"}`}>
          {preview.ok ? `Promo applied: ${formatNaira(preview.discount)} off. You pay ${formatNaira(preview.finalPrice)}.` : preview.error}
        </p>
      )}
    </div>
  );
}
