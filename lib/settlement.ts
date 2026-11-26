import "server-only";
import { after } from "next/server";
import {
  getTransactionState,
  hasRecordedDebit,
  listPendingIds,
  settlePending,
  type PendingTransactionId,
  type SettledTransaction,
} from "@/lib/db/settlement";
import { findTransaction, markRefunded } from "@/lib/db/transactions";
import { refundPurchase } from "@/lib/payment";
import { notify } from "@/lib/notify";
import { onPurchaseSuccess } from "@/lib/rewards";
import type { WebhookResult } from "@/lib/admin/webhooks";

type RefundState = "refunded" | "needed" | "none";

/** Refunds a failed purchase once. The `:refund` reference is the ledger idempotency key. */
async function refundIfNeeded(tx: SettledTransaction): Promise<RefundState> {
  if (tx.direction !== "debit" || tx.refunded) return "none";
  try {
    if (!tx.debited && !(await hasRecordedDebit(tx.id))) return "none";
    if (await refundPurchase(tx.customerId, tx.amount, tx.cashbackUsed, tx.id)) {
      await markRefunded(tx.id);
      return "refunded";
    }
  } catch (error) {
    console.error("[settlement] Refund call failed", tx.id, error);
  }
  console.error("[settlement] Refund needed", tx.id);
  return "needed";
}

async function announce(tx: SettledTransaction, outcome: "success" | "failed", refund: RefundState) {
  const info = await findTransaction(tx.id, tx.customerId).catch(() => null);
  const item = info?.title ?? "Your order";
  await notify(tx.customerId, {
    id: `tx-${tx.id}`,
    category: "transaction",
    title: outcome === "success" ? "Purchase successful" : "Purchase failed",
    body:
      outcome === "success"
        ? `${item} went through.`
        : `${item} couldn't be completed. ${refund === "refunded" ? "Your money is back in your wallet." : "Your refund is being processed."}`,
  });
}

export async function settleFromWebhook(input: {
  providerId: string;
  reference: string;
  outcome: "success" | "failed" | "pending";
  response: string;
}): Promise<WebhookResult> {
  const { providerId, reference, outcome, response } = input;
  if (outcome === "pending") return "ignored";

  const settled = await settlePending(reference, outcome, {
    providerId,
    response,
    reason: outcome === "failed" ? "The provider reported that this order failed." : undefined,
  });

  if (settled) {
    if (outcome === "failed") {
      const refund = await refundIfNeeded(settled);
      after(() => announce(settled, "failed", refund));
    } else {
      await onPurchaseSuccess(reference);
      after(() => announce(settled, "success", "none"));
    }
    return "applied";
  }

  const state = await getTransactionState(reference, providerId);
  if (!state) return "not_found";
  if (state.status === "failed" && outcome === "success") return "late_success";
  return "already_settled";
}

export type FailPendingReport = {
  failed: number;
  refunded: number;
  refundNeeded: number;
};

export async function failPending(
  olderThanMinutes: number,
  reason: string,
): Promise<FailPendingReport> {
  const report: FailPendingReport = { failed: 0, refunded: 0, refundNeeded: 0 };
  let cursor: PendingTransactionId | null = null;

  while (true) {
    const transactions = await listPendingIds(olderThanMinutes, cursor, 500);
    if (transactions.length === 0) break;
    cursor = transactions[transactions.length - 1];

    for (const transaction of transactions) {
      try {
        const settled = await settlePending(transaction.id, "failed", { reason });
        if (!settled) continue;
        report.failed += 1;
        const refund = await refundIfNeeded(settled);
        after(() => announce(settled, "failed", refund));
        if (refund === "refunded") report.refunded += 1;
        if (refund === "needed") report.refundNeeded += 1;
      } catch (error) {
        console.error("[settlement] Could not fail pending transaction", transaction.id, error);
      }
    }
  }
  return report;
}
