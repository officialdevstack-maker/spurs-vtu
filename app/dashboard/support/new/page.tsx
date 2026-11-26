import type { Metadata } from "next";
import { connection } from "next/server";
import { NewTicketForm } from "@/components/support/new-ticket-form";
import { getRecentTransactions } from "@/lib/db/transactions";
import { requireSpursUser } from "@/lib/spurs";

export const metadata: Metadata = { title: "New ticket | Spur VTU" };
export const instant = false;

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ transaction?: string }> }) {
  await connection();
  const user = await requireSpursUser();
  const { transaction } = await searchParams;
  const recent = await getRecentTransactions(user.sub, 20);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">New ticket</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Tell us what went wrong and we&apos;ll reply here and by email.</p>
      </header>
      <NewTicketForm
        transactions={recent.map((t) => ({ id: t.id, title: t.title, amount: t.amount }))}
        defaultTransaction={typeof transaction === "string" ? transaction : ""}
      />
    </div>
  );
}
