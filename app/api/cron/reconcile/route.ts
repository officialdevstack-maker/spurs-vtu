import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { listPendingIds } from "@/lib/db/settlement";
import { getTransactionProviderId, openReconciliation } from "@/lib/db/reconciliation";
import { requeryOrder } from "@/lib/reconcile";
import { settleFromWebhook } from "@/lib/settlement";

const MIN_AGE_MIN = 10;
const STUCK_AFTER_MIN = 60;
const BUDGET_MS = 25_000;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "CRON_SECRET is missing or too short" }, { status: 503 });
  }
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const report = { checked: 0, settled: 0, queued: 0 };
  try {
    const pending = await listPendingIds(MIN_AGE_MIN, null, 100);
    for (const tx of pending) {
      if (Date.now() - started > BUDGET_MS) break;
      const providerId = await getTransactionProviderId(tx.id);
      if (!providerId) continue;
      report.checked += 1;

      const requery = await requeryOrder(providerId, tx.id);
      if (requery.outcome === "success" || requery.outcome === "failed") {
        const result = await settleFromWebhook({
          providerId, reference: tx.id, outcome: requery.outcome, response: requery.response,
        });
        if (result === "applied") report.settled += 1;
        if (result === "late_success") {
          await openReconciliation(tx.id, "late_success", providerId);
          report.queued += 1;
        }
        continue;
      }

      const ageMin = (Date.now() - tx.createdAt.getTime()) / 60_000;
      if (ageMin >= STUCK_AFTER_MIN) {
        await openReconciliation(tx.id, "stuck_pending", providerId);
        report.queued += 1;
      }
    }
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[cron] Reconcile failed", error);
    return NextResponse.json({ error: "Could not reconcile" }, { status: 500 });
  }
}
