import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { ReceiptCard } from "@/components/receipt/receipt-card";
import { ReceiptShare } from "@/components/receipt/receipt-share";
import { getReceipt } from "@/lib/db/receipts";
import { requireSpursUser } from "@/lib/spurs";

export const metadata: Metadata = { title: "Receipt | Spur VTU" };
export const instant = false;

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await requireSpursUser();
  const { id } = await params;
  const receipt = await getReceipt(id, user.sub);
  if (!receipt) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center gap-2 rounded text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Transactions
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Receipt</h1>
      </header>
      <ReceiptCard receipt={receipt} detail={receipt.detail} />
      {receipt.status === "success" && receipt.direction === "debit" && <ReceiptShare id={receipt.id} />}
    </div>
  );
}
