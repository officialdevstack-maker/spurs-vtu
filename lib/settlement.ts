import "server-only";
import {
  getTransactionState,
  listPendingIds,
  settlePending,
  type PendingTransactionId,
  type SettledTransaction,
} from "@/lib/db/settlement";
import { markRefunded } from "@/lib/db/transactions";
import { creditWallet } from "@/lib/wallet";
import type { WebhookResult } from "@/lib/admin/webhooks";

type RefundState = "refunded" | "needed" | "none";

/** Refunds a failed purchase once. The `:refund` reference is the wallet's idempotency key. */
async function refundIfNeeded(tx: SettledTransaction): Promise<RefundState> {
  if (tx.direction !== "debit" || !tx.debited || tx.refunded) return "none";
  try {
    if (await creditWallet(tx.customerId, tx.amount, `${tx.id}:refund`)) {
      await markRefunded(tx.id);
      return "refunded";
    }
  } catch (error) {
    console.error("[settlement] Refund call failed", tx.id, error);
  }
  console.error("[settlement] Refund needed", tx.id);
  return "needed";
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
    if (outcome === "failed") await refundIfNeeded(settled);
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
  unverified: number;
};

export async function failPending(olderThanMinutes: number, reason: string): Promise<FailPendingReport> {
  const report: FailPendingReport = { failed: 0, refunded: 0, refundNeeded: 0, unverified: 0 };
  let cursor: PendingTransactionId | null = null;

  while (true) {
    const transactions = await listPendingIds(olderThanMinutes, cursor);
    if (transactions.length === 0) break;
    cursor = transactions[transactions.length - 1];

    for (const transaction of transactions) {
      try {
        const settled = await settlePending(transaction.id, "failed", { reason });
        if (!settled) continue;
        report.failed += 1;
        if (!settled.debited) {
          report.unverified += 1;
          continue;
        }
        const refund = await refundIfNeeded(settled);
        if (refund === "refunded") report.refunded += 1;
        if (refund === "needed") report.refundNeeded += 1;
      } catch (error) {
        console.error("[settlement] Could not fail pending transaction", transaction.id, error);
      }
    }
  }
  return report;
}
