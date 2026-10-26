export const WEBHOOKS_PATH = "/admin/gateways/webhooks";
export const AUTO_FAIL_KEY = "pending_auto_fail_minutes";
export const MIN_AUTO_FAIL_MINUTES = 5;
export const MAX_MINUTES = 10_080;

export type WebhookOutcome = "success" | "failed" | "pending";
export type WebhookResult = "applied" | "ignored" | "not_found" | "already_settled" | "late_success";

export const RESULT_LABELS: Record<WebhookResult, string> = {
  applied: "Applied",
  ignored: "No change (still pending)",
  not_found: "Unknown reference",
  already_settled: "Already settled",
  late_success: "Late success: needs review",
};

export type ProviderWebhook = { id: string; name: string; enabled: boolean; url: string };

export type WebhookEvent = {
  id: string;
  providerName: string;
  reference: string | null;
  outcome: WebhookOutcome;
  result: WebhookResult;
  at: string;
};

export type PendingSummary = { count: number; oldest: string | null };

export const webhookPath = (token: string) => `/api/webhooks/providers/${token}`;
