import "server-only";
import { renderTemplate, type BroadcastResults, type Channel } from "@/lib/admin/announcements";
import {
  claimBroadcast,
  finishBroadcast,
  insertSystemNotifications,
  nextAudienceChunk,
  saveProgress,
} from "@/lib/db/announcements";
import { deliver } from "@/lib/messaging/send";

const CHUNK = 50;
const CONCURRENCY = 10;

function tally(results: BroadcastResults, channel: Channel, key: "sent" | "failed" | "skipped", n = 1) {
  const row = (results[channel] ??= { sent: 0, failed: 0, skipped: 0 });
  row[key] += n;
}

async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

export async function processBroadcast(id: string, budgetMs = 25_000): Promise<void> {
  const job = await claimBroadcast(id);
  if (!job) return;

  const started = Date.now();
  let cursor = job.cursor;
  let processed = job.processed;
  const results = job.results;

  try {
    while (true) {
      if (Date.now() - started > budgetMs) {
        await saveProgress(id, { cursor, processed, results }, true);
        return;
      }

      const chunk = await nextAudienceChunk(job.audience, job.packageId, cursor, CHUNK);
      if (chunk.length === 0) break;

      if (job.channels.includes("system")) {
        const inserted = await insertSystemNotifications(id, chunk.map((r) => ({
          customerId: r.id,
          title: renderTemplate(job.title, r),
          body: renderTemplate(job.body, r),
        })));
        tally(results, "system", "sent", inserted);
      }

      for (const channel of ["email", "sms", "push"] as const) {
        if (!job.channels.includes(channel)) continue;
        await runPool(chunk, CONCURRENCY, async (r) => {
          const optedIn = channel === "email" ? r.notifyEmail : channel === "sms" ? r.notifySms : r.notifyPush;
          if (!r.notifyPromotions || !optedIn) {
            tally(results, channel, "skipped");
            return;
          }
          tally(results, channel, await deliver(channel, r, renderTemplate(job.title, r), renderTemplate(job.body, r)));
        });
      }

      cursor = chunk[chunk.length - 1].id;
      processed += chunk.length;
      await saveProgress(id, { cursor, processed, results });
    }
    await finishBroadcast(id, "sent");
  } catch (error) {
    console.error("[broadcast] Failed", id, error);
    await finishBroadcast(id, "failed").catch(() => undefined);
  }
}

