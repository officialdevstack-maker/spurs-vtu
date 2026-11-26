import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReceiptCard } from "@/components/receipt/receipt-card";
import { getReceipt } from "@/lib/db/receipts";
import { maskDetail, verifyReceiptToken } from "@/lib/receipt";

export const metadata: Metadata = {
  title: "Receipt | Spur VTU",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PublicReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const id = verifyReceiptToken(token);
  const receipt = id ? await getReceipt(id, null) : null;
  if (!receipt || receipt.status !== "success" || receipt.direction !== "debit") notFound();

  return (
    <main className="grid min-h-dvh place-items-center bg-[#EEF3F4] p-4 dark:bg-[#0B1B1F]">
      <ReceiptCard receipt={{ ...receipt, cashbackUsed: 0 }} detail={maskDetail(receipt.detail)} />
    </main>
  );
}
