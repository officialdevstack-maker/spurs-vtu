import "server-only";
import type { Recipient } from "@/lib/admin/announcements";
import {
  claimAlert, listAlertRecipients, listMonitored, saveCheck,
  type BalanceRow, type BalanceState,
} from "@/lib/db/balances";
import { insertNotificationOnce } from "@/lib/db/notify";
import { formatNaira } from "@/lib/format";
import { deliver } from "@/lib/messaging/send";
import { callProviderEndpoint } from "@/lib/providers/call";
import { mappedAmount, readPath, toAmount } from "@/lib/providers/response-map";

const FAILURES_BEFORE_ERROR = 3;
const REMIND_MS = 12 * 60 * 60 * 1000;
const FALLBACK_KEYS = ["balance", "wallet_balance", "available_balance", "availableBalance", "walletBalance"];

function findBalance(data: unknown, depth = 0): number | null {
  if (!data || typeof data !== "object" || Array.isArray(data) || depth > 2) return null;
  const record = data as Record<string, unknown>;
  for (const key of FALLBACK_KEYS) {
    const amount = toAmount(readPath(record, key));
    if (amount !== null) return amount;
  }
  return findBalance(record.data, depth + 1);
}

async function readBalance(providerId: string): Promise<{ balance: number } | { error: string }> {
  try {
    const result = await callProviderEndpoint(providerId, "balance", {});
    if (!result.ok) return { error: `Provider returned ${result.status}` };
    const balance = result.map?.balance ? mappedAmount(result, "balance") : findBalance(result.data);
    if (balance === null) return { error: "No balance found in the response. Check the response mapping." };
    return { balance };
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 200) : "Balance check failed" };
  }
}

function shouldAlert(state: BalanceState, row: BalanceRow): boolean {
  if (state === "ok") return row.alertedState === "low" || row.alertedState === "error";
  if (state !== "low" && state !== "error") return false;
  if (row.alertedState !== state) return true;
  return !row.lastAlertedAt || Date.now() - row.lastAlertedAt.getTime() > REMIND_MS;
}

function message(row: BalanceRow, state: BalanceState, balance: number | null, error: string | null) {
  if (state === "low") {
    return {
      title: `${row.providerName} balance is low`,
      body: `${row.providerName} has ${formatNaira(balance ?? 0)} left, below your ${formatNaira(row.threshold ?? 0)} threshold. Top it up to avoid failed orders.`,
    };
  }
  if (state === "error") {
    return {
      title: `Can't check ${row.providerName} balance`,
      body: `The last ${FAILURES_BEFORE_ERROR} balance checks failed${error ? `: ${error}` : ""}. Check the provider's balance endpoint.`,
    };
  }
  return {
    title: `${row.providerName} balance is back to normal`,
    body: `${row.providerName} now has ${formatNaira(balance ?? 0)}.`,
  };
}

async function alert(row: BalanceRow, state: BalanceState, balance: number | null, error: string | null) {
  const { title, body } = message(row, state, balance, error);
  const stamp = Math.floor(Date.now() / 60_000);
  const recipients = await listAlertRecipients();
  await Promise.allSettled(
    recipients.flatMap((person) => {
      const recipient: Recipient = {
        id: person.id, name: null, username: null, email: person.email, phone: person.phone,
        notifyEmail: true, notifySms: true, notifyPush: false, notifyPromotions: true,
      };
      return [
        insertNotificationOnce({ id: `bal-${row.providerId}-${state}-${stamp}-${person.id}`, customerId: person.id, title, body }),
        deliver("email", recipient, title, body),
        deliver("sms", recipient, title, `${title}: ${body}`.slice(0, 320)),
      ];
    }),
  );
}

export type BalanceReport = { checked: number; low: number; errors: number; alerts: number };

export async function runBalanceCheck(options: { providerId?: string; budgetMs?: number } = {}): Promise<BalanceReport> {
  const started = Date.now();
  const report: BalanceReport = { checked: 0, low: 0, errors: 0, alerts: 0 };

  for (const row of await listMonitored(options.providerId)) {
    if (Date.now() - started > (options.budgetMs ?? 25_000)) break;
    report.checked += 1;

    const read = await readBalance(row.providerId);
    let state: BalanceState = row.state;
    let balance: number | null = null;
    let failures = 0;
    let error: string | null = null;

    if ("balance" in read) {
      balance = read.balance;
      failures = 0;
      state = row.threshold !== null && balance < row.threshold ? "low" : "ok";
    } else {
      failures = row.failures + 1;
      error = read.error;
      if (failures >= FAILURES_BEFORE_ERROR) state = "error";
      console.error("[balance] Check failed", row.providerId, read.error);
    }

    await saveCheck(row.providerId, { balance, state, failures, error });
    if (state === "low") report.low += 1;
    if (state === "error") report.errors += 1;

    if (shouldAlert(state, row) && (await claimAlert(row.providerId, state, row))) {
      await alert(row, state, balance, error);
      report.alerts += 1;
    }
  }
  return report;
}
