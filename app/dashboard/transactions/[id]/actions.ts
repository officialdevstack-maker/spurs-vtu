"use server";

import { getReceipt } from "@/lib/db/receipts";
import { receiptUrls, signReceiptToken } from "@/lib/receipt";
import { requireSpursUser } from "@/lib/spurs";

export type ShareResult = { ok: true; page: string; image: string } | { ok: false; error: string };

export async function createReceiptLink(id: unknown): Promise<ShareResult> {
  const user = await requireSpursUser();
  if (typeof id !== "string" || !id) return { ok: false, error: "That receipt isn't valid. Refresh the page." };
  try {
    const receipt = await getReceipt(id, user.sub);
    if (!receipt || receipt.status !== "success" || receipt.direction !== "debit") {
      return { ok: false, error: "Only successful purchases can be shared." };
    }
    const urls = receiptUrls(signReceiptToken(id));
    if (!urls.page.startsWith("http")) return { ok: false, error: "Sharing isn't available right now." };
    return { ok: true, ...urls };
  } catch (error) {
    console.error("[receipt] Could not create link", error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
