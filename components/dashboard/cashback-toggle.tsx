import { formatNaira } from "@/lib/format";

export function CashbackToggle({
  balance,
  price,
  checked,
  onChange,
}: {
  balance: number;
  price: number;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  if (balance <= 0) return null;
  const used = Math.min(balance, price);
  return (
    <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 text-sm dark:border-white/10">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4" />
      <span>
        <span className="block font-medium">Use cashback ({formatNaira(balance)} available)</span>
        {checked && price > 0 && (
          <span className="block text-gray-600 dark:text-[#9FB3B7]">
            {formatNaira(used)} from cashback, {formatNaira(price - used)} from your wallet.
          </span>
        )}
      </span>
    </label>
  );
}
