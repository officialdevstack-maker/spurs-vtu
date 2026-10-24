import type { ProviderResponse } from "@/lib/providers/call";

export type Outcome = "success" | "failed" | "pending";

const SUCCESS = new Set(["success", "successful", "completed", "complete", "delivered", "ok", "approved"]);
const FAILED = new Set(["failed", "fail", "error", "declined", "rejected", "unsuccessful", "insufficient_balance"]);
const WAITING = new Set(["pending", "processing", "queued", "initiated", "in_progress"]);

function statusOf(data: unknown, depth = 0): string | boolean | undefined {
  if (!data || typeof data !== "object" || depth > 2) return undefined;
  const record = data as Record<string, unknown>;
  for (const key of ["status", "Status", "state", "success"]) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "boolean") return value;
  }
  return statusOf(record.data, depth + 1);
}

/** Unclear provider results stay pending so a possibly delivered order is not refunded. */
export function interpretProviderResponse(response: ProviderResponse): Outcome {
  if (response.status >= 500 || response.status === 408) return "pending";
  if (!response.ok) return "failed";

  const status = statusOf(response.data);
  if (status === true) return "success";
  if (status === false) return "failed";
  if (typeof status === "string") {
    const key = status.trim().toLowerCase().replace(/\s+/g, "_");
    if (SUCCESS.has(key)) return "success";
    if (FAILED.has(key)) return "failed";
    if (WAITING.has(key)) return "pending";
  }
  return "pending";
}
