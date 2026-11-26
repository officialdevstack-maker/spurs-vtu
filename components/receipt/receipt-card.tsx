import { formatNaira } from "@/lib/format";
import type { Receipt } from "@/lib/db/receipts";

const STATUS = {
  success: { label: "Successful", dot: "bg-[#1E8E4F]" },
  pending: { label: "Pending", dot: "bg-[#F2B632]" },
  failed: { label: "Failed", dot: "bg-[#C8432B]" },
} as const;

function when(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

export function ReceiptCard({ receipt, detail }: { receipt: Receipt; detail: string }) {
  const status = STATUS[receipt.status];
  const walletPart = Math.max(0, receipt.amount - receipt.cashbackUsed);
  const note =
    receipt.status === "pending"
      ? "Waiting for the provider to confirm."
      : receipt.status === "failed"
        ? receipt.refunded
          ? "Refunded to your wallet."
          : receipt.debited
            ? "Refund in progress."
            : receipt.failureReason
        : null;

  const rows: [string, string][] = [
    ["Date", when(receipt.at)],
    ...(detail ? ([["Sent to", detail]] as [string, string][]) : []),
    ...(receipt.direction === "debit" && receipt.cashbackUsed > 0
      ? ([["Paid from wallet", formatNaira(walletPart)], ["Paid with cashback", formatNaira(receipt.cashbackUsed)]] as [string, string][])
      : []),
    ["Reference", receipt.id],
  ];

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-7 text-[#12343B] shadow-sm">
      <p className="text-sm text-[#5B7176]">Spur VTU receipt</p>
      <p className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums">{formatNaira(receipt.amount)}</p>
      <p className="mt-1 text-base font-medium">{receipt.title}</p>
      <p className="mt-2 flex items-center gap-2 text-sm">
        <span aria-hidden="true" className={`size-2 rounded-full ${status.dot}`} />
        {status.label}
      </p>
      {note && <p className="mt-1 text-sm text-[#5B7176]">{note}</p>}
      <dl className="mt-6 space-y-3 border-t border-dashed border-[#B9C8CB] pt-5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="shrink-0 text-[#5B7176]">{label}</dt>
            <dd className={`min-w-0 break-all text-right font-medium ${label === "Reference" ? "font-mono text-xs" : ""}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
