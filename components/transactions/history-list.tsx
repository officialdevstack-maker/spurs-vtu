import Link from "next/link";
import { Receipt, Smartphone, Tv, Wallet, Wifi, Zap, type LucideIcon } from "lucide-react";
import { formatNaira, formatNumber, formatWhen } from "@/lib/format";
import type { TxService, TxStatus } from "@/lib/dashboard-data";
import type { HistoryItem } from "@/lib/db/transactions";
import {
  HISTORY_PAGE_SIZE,
  SERVICE_OPTIONS,
  STATUS_OPTIONS,
  historyHref,
  type HistoryQuery,
} from "@/lib/transactions-history";

const ICONS: Record<TxService, LucideIcon> = {
  airtime: Smartphone,
  data: Wifi,
  cable: Tv,
  electricity: Zap,
  wallet: Wallet,
};

const STATUS: Record<TxStatus, { label: string; dot: string }> = {
  success: { label: "Successful", dot: "bg-[#1E8E4F] dark:bg-[#4CC38A]" },
  pending: { label: "Pending", dot: "bg-[#F2B632]" },
  failed: { label: "Failed", dot: "bg-[#C8432B]" },
};

const fieldClass =
  "h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]";

function noteFor(tx: HistoryItem, admin: boolean): string | null {
  if (tx.status === "pending") return "Waiting for the network to confirm.";
  if (tx.status !== "failed") return null;
  if (tx.refunded) return "Refunded to wallet.";
  if (tx.debited) return admin ? "Refund needed: wallet was debited." : "Refund in progress.";
  return tx.failureReason;
}

export function HistoryFilters({ basePath, query }: { basePath: string; query: HistoryQuery }) {
  return (
    <form
      method="get"
      action={basePath}
      className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-100 p-4 dark:border-white/10 dark:bg-white/5 lg:flex-row"
    >
      <label className="sr-only" htmlFor="tx-search">
        Search transactions
      </label>
      <input
        id="tx-search"
        name="q"
        type="search"
        defaultValue={query.query}
        placeholder="Search by title, number or reference"
        className={`${fieldClass} min-w-0 flex-1`}
      />
      <label className="sr-only" htmlFor="tx-service">
        Filter by service
      </label>
      <select id="tx-service" name="service" defaultValue={query.service} className={fieldClass}>
        {SERVICE_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="tx-status">
        Filter by status
      </label>
      <select id="tx-status" name="status" defaultValue={query.status} className={fieldClass}>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] outline-none hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B]"
      >
        Search
      </button>
    </form>
  );
}

export function HistoryList({
  items,
  admin = false,
  filtered = false,
}: {
  items: HistoryItem[];
  admin?: boolean;
  filtered?: boolean;
}) {
  const now = new Date();

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
        <Receipt className="mx-auto size-8 text-gray-400" aria-hidden="true" />
        <p className="mt-3 font-medium">{filtered ? "No matching transactions" : "No transactions yet"}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
          {filtered
            ? "Try a different search or clear the filters."
            : admin
              ? "Purchases from all customers will show up here."
              : "Your purchases and wallet top-ups will show up here."}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
      {items.map((tx) => {
        const Icon = ICONS[tx.service];
        const status = STATUS[tx.status];
        const credit = tx.direction === "credit";
        const note = noteFor(tx, admin);
        const who = tx.admin ? (tx.admin.username ? `@${tx.admin.username}` : (tx.admin.customerName ?? "Unknown")) : null;
        return (
          <li key={tx.id} className="flex min-w-0 items-center gap-3 px-3 py-4 sm:gap-4 sm:px-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gray-100 text-[#12343B] dark:bg-white/10 dark:text-[#EEF3F4]">
              <Icon className="size-5" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{tx.title}</p>
              <p className="truncate text-sm text-gray-600 dark:text-[#9FB3B7]">
                {who ? `${who} · ` : ""}
                {tx.detail ? `${tx.detail} · ` : ""}
                {formatWhen(tx.at, now)}
              </p>
              {note && (
                <p
                  className={`truncate text-sm ${
                    admin && note.startsWith("Refund needed") ? "font-medium text-[#C8432B]" : "text-gray-600 dark:text-[#9FB3B7]"
                  }`}
                >
                  {note}
                </p>
              )}
              {tx.admin && (
                <p className="truncate font-[family-name:var(--font-geist-mono)] text-xs text-gray-600 dark:text-[#9FB3B7]">
                  {tx.id}
                  {tx.admin.providerName ? ` · via ${tx.admin.providerName}` : ""}
                  {tx.admin.cost !== null ? ` · cost ${formatNaira(tx.admin.cost)}` : ""}
                </p>
              )}
            </div>

            <div className="min-w-0 shrink-0 text-right">
              <p className={`font-semibold tabular-nums ${credit ? "text-[#1E8E4F] dark:text-[#4CC38A]" : ""}`}>
                {credit ? "+" : ""}
                {formatNaira(tx.amount)}
              </p>
              <p className="mt-0.5 flex items-center justify-end gap-1.5 text-sm text-gray-600 dark:text-[#9FB3B7]">
                <span aria-hidden="true" className={`size-2 rounded-full ${status.dot}`} />
                {status.label}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function HistoryPagination({
  basePath,
  query,
  page,
  total,
}: {
  basePath: string;
  query: HistoryQuery;
  page: number;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * HISTORY_PAGE_SIZE + 1;
  const end = Math.min(page * HISTORY_PAGE_SIZE, total);
  const linkClass =
    "rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-100 dark:border-white/15 dark:hover:bg-white/10";
  const offClass = "rounded-lg border border-gray-200 px-3 py-2 opacity-50 dark:border-white/10";

  return (
    <div className="flex flex-col gap-3 text-sm text-gray-600 dark:text-[#9FB3B7] sm:flex-row sm:items-center sm:justify-between">
      <p>{total === 0 ? "0 transactions" : `${start}–${end} of ${formatNumber(total)} transactions`}</p>
      <nav aria-label="Transaction pages" className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={linkClass} href={historyHref(basePath, query, page - 1)}>
            Previous
          </Link>
        ) : (
          <span className={offClass}>Previous</span>
        )}
        <span aria-current="page" className="px-2">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link className={linkClass} href={historyHref(basePath, query, page + 1)}>
            Next
          </Link>
        ) : (
          <span className={offClass}>Next</span>
        )}
      </nav>
    </div>
  );
}
