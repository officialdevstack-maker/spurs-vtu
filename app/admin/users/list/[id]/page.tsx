import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { RULE_META } from "@/lib/admin/fraud";
import { STATUS_LABEL, SUPPORT_PATH } from "@/lib/admin/support";
import { getCashbackBalance } from "@/lib/cashback";
import { listAudit } from "@/lib/db/audit";
import { getCustomerDetail } from "@/lib/db/customers";
import { listCustomerFlags } from "@/lib/db/fraud";
import { getReferralOverview } from "@/lib/db/referrals";
import { listCustomerTickets } from "@/lib/db/support";
import { listCustomerTransactions } from "@/lib/db/transactions";
import { formatNaira, formatWhen } from "@/lib/format";
import { getNairaBalance } from "@/lib/wallet";
import { CustomerStatusButton } from "../customer-status-button";
import { CustomerActions } from "./customer-actions";

export const metadata: Metadata = { title: "Customer | Spur VTU" };

const muted = "text-gray-600 dark:text-[#9FB3B7]";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className={`text-sm ${muted}`}>{children}</p>;

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requirePermission("customers.view");
  const { permissions } = await getAdminAccess();
  const { id } = await params;

  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  const canManage = permissions.has("customers.manage");
  const now = new Date();
  const [balance, cashback, referrals, flags, transactions, tickets, audit] = await Promise.all([
    getNairaBalance(id),
    getCashbackBalance(id),
    getReferralOverview(id),
    listCustomerFlags(id),
    permissions.has("transactions.view")
      ? listCustomerTransactions(id, { query: "", status: "all", service: "all", page: 1, pageSize: 10 })
      : null,
    permissions.has("support.manage") ? listCustomerTickets(id, 10) : null,
    permissions.has("audit.view") ? listAudit({ query: id, page: 1, pageSize: 10 }) : null,
  ]);

  const label = customer.name || customer.username || customer.email || "this customer";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link
          href="/admin/users/list"
          className="inline-flex items-center gap-2 rounded text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Customers
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">{label}</h1>
            <p className={`mt-1 ${muted}`}>
              {customer.username ? `@${customer.username} · ` : ""}
              {customer.status === "active" ? "Active" : "Suspended"}
              {customer.staffRole ? ` · Staff (${customer.staffRole})` : ""}
              {customer.fraudExempt ? " · Exempt from fraud checks" : ""}
            </p>
          </div>
          {canManage && (
            <CustomerStatusButton customerId={customer.id} customerName={label} status={customer.status} />
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Wallet", balance === null ? "Unavailable" : formatNaira(balance)],
          ["Cashback", formatNaira(cashback)],
          ["Package", customer.packageName ?? "—"],
          ["Referrals", `${referrals.invited} joined · ${referrals.rewarded} rewarded`],
        ].map(([title, value]) => (
          <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <p className={`text-sm ${muted}`}>{title}</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className={muted}>Email</dt>
            <dd className="break-all">{customer.email ?? "—"}</dd>
            <dt className={muted}>Phone</dt>
            <dd>{customer.phone ?? "—"}</dd>
            <dt className={muted}>Joined</dt>
            <dd>{formatWhen(customer.createdAt, now)}</dd>
            <dt className={muted}>Last seen</dt>
            <dd>{formatWhen(customer.lastSeenAt, now)}</dd>
            <dt className={muted}>Transaction PIN</dt>
            <dd>{customer.hasPin ? "Set" : "Not set"}</dd>
            <dt className={muted}>Spurs ID</dt>
            <dd className="break-all font-mono text-xs">{customer.id}</dd>
          </dl>
          {canManage && (
            <div className="mt-5">
              <CustomerActions
                customerId={customer.id}
                name={label}
                hasPin={customer.hasPin}
                fraudExempt={customer.fraudExempt}
              />
            </div>
          )}
        </Card>

        <Card title="Fraud flags">
          {flags.length === 0 ? (
            <Empty>No flags for this customer.</Empty>
          ) : (
            <ul className="divide-y divide-gray-200 text-sm dark:divide-white/10">
              {flags.map((flag) => (
                <li key={flag.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {RULE_META[flag.rule].label} <span className={muted}>({flag.action})</span>
                  </span>
                  <span className={`shrink-0 text-xs ${muted}`}>
                    {flag.status === "open" ? "Open" : `Reviewed: ${flag.resolution}`} · {formatWhen(flag.at, now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/users/fraud" className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
            Open fraud review
          </Link>
        </Card>
      </div>

      {transactions && (
        <Card title={`Recent transactions (${transactions.total} total)`}>
          {transactions.items.length === 0 ? (
            <Empty>No transactions yet.</Empty>
          ) : (
            <ul className="divide-y divide-gray-200 text-sm dark:divide-white/10">
              {transactions.items.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tx.title}</p>
                    <p className={`text-xs ${muted}`}>
                      {formatWhen(tx.at, now)} · {tx.status}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">
                    {tx.direction === "credit" ? "+" : "−"}
                    {formatNaira(tx.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/admin/transactions/list?q=${encodeURIComponent(customer.username ?? customer.email ?? "")}`}
            className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
          >
            See full history
          </Link>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {tickets && (
          <Card title="Support tickets">
            {tickets.length === 0 ? (
              <Empty>No tickets.</Empty>
            ) : (
              <ul className="divide-y divide-gray-200 text-sm dark:divide-white/10">
                {tickets.map((ticket) => (
                  <li key={ticket.id} className="py-2">
                    <Link href={`${SUPPORT_PATH}/${ticket.id}`} className="font-medium underline-offset-4 hover:underline">
                      {ticket.subject}
                    </Link>
                    <p className={`text-xs ${muted}`}>
                      {STATUS_LABEL[ticket.status].admin} · {ticket.messages} messages · {formatWhen(ticket.at, now)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {audit && (
          <Card title="Audit trail">
            {audit.items.length === 0 ? (
              <Empty>No admin actions recorded for this customer.</Empty>
            ) : (
              <ul className="divide-y divide-gray-200 text-sm dark:divide-white/10">
                {audit.items.map((entry) => (
                  <li key={entry.id} className="py-2">
                    <p>{entry.summary}</p>
                    <p className={`text-xs ${muted}`}>
                      {entry.actor} · {formatWhen(entry.at, now)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
