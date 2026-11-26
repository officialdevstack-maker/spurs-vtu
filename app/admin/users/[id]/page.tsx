import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { getAdminAccess, requirePermission } from "@/lib/admin/auth";
import { FRAUD_PATH, RULE_META } from "@/lib/admin/fraud";
import { STATUS_LABEL } from "@/lib/admin/support";
import { getCustomerDetail } from "@/lib/db/customer-detail";
import { listPackages } from "@/lib/db/packages";
import { formatNaira, formatWhen } from "@/lib/format";
import { CustomerStatusButton } from "../list/customer-status-button";
import { CustomerActions } from "./customer-actions";

export const metadata: Metadata = { title: "Customer | Spur VTU" };

const card = "rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5";
const muted = "text-gray-600 dark:text-[#9FB3B7]";
const h2 = "font-[family-name:var(--font-display)] text-lg font-bold";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={card}>
      <p className={`text-sm ${muted}`}>{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const admin = await requirePermission("customers.view");
  const { permissions } = await getAdminAccess();
  const { id } = await params;
  const [customer, packages] = await Promise.all([getCustomerDetail(id), listPackages()]);
  if (!customer) notFound();

  const label = customer.name || customer.username || customer.email || "Unnamed customer";
  const canManage = permissions.has("customers.manage");
  const canAdjust = permissions.has("settings.manage");
  const search = customer.username || customer.email || "";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-3">
        <Link
          href="/admin/users/list"
          className="inline-flex items-center gap-2 rounded text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Customers
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">{label}</h1>
            <p className={`mt-1 text-sm ${muted}`}>
              {customer.username && <>@{customer.username} · </>}
              {customer.email ?? "No email"} · {customer.phone ?? "No phone"}
            </p>
            <p className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className={`rounded-full px-2.5 py-1 ${customer.status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-300"}`}>
                {customer.status === "active" ? "Active" : "Suspended"}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-white/10">{customer.packageName}</span>
              {customer.isStaff && <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-white/10">Staff</span>}
              {customer.fraudExempt && <span className="rounded-full bg-[#FFF3D1] px-2.5 py-1 text-[#7A5600] dark:bg-[#F2B632]/15 dark:text-[#F2B632]">Exempt from fraud checks</span>}
            </p>
          </div>
          {canManage && customer.id !== admin.sub && (
            <CustomerStatusButton customerId={customer.id} customerName={label} status={customer.status} />
          )}
        </div>
        <CustomerActions
          customerId={customer.id}
          packages={packages.map((p) => ({ id: p.id, name: p.name }))}
          currentPackageId={customer.packageId}
          fraudExempt={customer.fraudExempt}
          hasPin={customer.pin.hasPin}
          canManage={canManage}
          canAdjust={canAdjust}
          isSelf={customer.id === admin.sub}
        />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Wallet" value={formatNaira(customer.walletBalance)} />
        <Stat label="Cashback" value={formatNaira(customer.cashbackBalance)} />
        <Stat label="Successful purchases" value={String(customer.spend.purchases)} />
        <Stat label="Total spent" value={formatNaira(customer.spend.total)} />
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className={`${card} min-w-0`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={h2}>Recent transactions</h2>
            {search && (
              <Link href={`/admin/transactions/list?q=${encodeURIComponent(search)}`} className="text-sm font-medium underline underline-offset-4">
                View all
              </Link>
            )}
          </div>
          {customer.transactions.length === 0 ? (
            <p className={`mt-3 text-sm ${muted}`}>No transactions yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-200 dark:divide-white/10">
              {customer.transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tx.title}</p>
                    <p className={`text-xs ${muted}`}>{formatWhen(tx.at)} · {tx.status}</p>
                  </div>
                  <p className={`shrink-0 font-semibold tabular-nums ${tx.direction === "credit" ? "text-[#1E8E4F] dark:text-[#4CC38A]" : ""}`}>
                    {tx.direction === "credit" ? "+" : "−"}{formatNaira(tx.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="min-w-0 space-y-6">
          <section className={card}>
            <h2 className={h2}>Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className={muted}>Joined</dt><dd>{formatWhen(customer.createdAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt className={muted}>Last seen</dt><dd>{formatWhen(customer.lastSeenAt)}</dd></div>
              <div className="flex justify-between gap-4">
                <dt className={muted}>Transaction PIN</dt>
                <dd>{customer.pin.lockedUntil ? `Locked until ${formatWhen(customer.pin.lockedUntil)}` : customer.pin.hasPin ? "Set" : "Not set"}</dd>
              </div>
              <div className="flex justify-between gap-4"><dt className={muted}>Spurs ID</dt><dd className="break-all font-mono text-xs">{customer.id}</dd></div>
            </dl>
          </section>
          <section className={card}>
            <h2 className={h2}>Referrals</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className={muted}>Code</dt><dd className="font-mono">{customer.referralCode ?? "None yet"}</dd></div>
              <div className="flex justify-between gap-4">
                <dt className={muted}>Invited by</dt>
                <dd>{customer.referral.referrer ? `${customer.referral.referrer} (${customer.referral.status === "rewarded" ? "rewarded" : "waiting on first purchase"})` : "No one"}</dd>
              </div>
              <div className="flex justify-between gap-4"><dt className={muted}>Friends invited</dt><dd>{customer.referral.invited} ({customer.referral.rewarded} rewarded)</dd></div>
            </dl>
          </section>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className={`${card} min-w-0`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={h2}>Support tickets</h2>
            <Link href="/admin/support" className="text-sm font-medium underline underline-offset-4">All tickets</Link>
          </div>
          {customer.tickets.length === 0 ? (
            <p className={`mt-3 text-sm ${muted}`}>No tickets.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-200 dark:divide-white/10">
              {customer.tickets.map((ticket) => (
                <li key={ticket.id} className="py-3 text-sm">
                  <Link href={`/admin/support/${ticket.id}`} className="font-medium underline-offset-4 hover:underline">{ticket.subject}</Link>
                  <p className={`text-xs ${muted}`}>{STATUS_LABEL[ticket.status].admin} · {formatWhen(ticket.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`${card} min-w-0`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={h2}>Fraud flags</h2>
            <Link href={FRAUD_PATH} className="text-sm font-medium underline underline-offset-4">Review queue</Link>
          </div>
          {customer.flags.length === 0 ? (
            <p className={`mt-3 text-sm ${muted}`}>No flags.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-200 dark:divide-white/10">
              {customer.flags.map((flag) => (
                <li key={flag.id} className="py-3 text-sm">
                  <p className="font-medium">{RULE_META[flag.rule]?.label ?? flag.rule} · {flag.action}</p>
                  <p className={`text-xs ${muted}`}>
                    {flag.status === "open" ? "Open" : flag.resolution === "confirmed" ? "Confirmed" : "Dismissed"} · {formatWhen(flag.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={card}>
        <h2 className={h2}>Admin activity on this customer</h2>
        {customer.audit.length === 0 ? (
          <p className={`mt-3 text-sm ${muted}`}>Nothing recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-200 dark:divide-white/10">
            {customer.audit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <p>{entry.summary}</p>
                <p className={`text-xs ${muted}`}>{entry.actor} · {formatWhen(entry.at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
