import "server-only";
import type { ProviderResponse } from "@/lib/providers/call";
import type { Outcome } from "@/lib/providers/result";

const KEYS = new Set([
  "status",
  "state",
  "success",
  "code",
  "message",
  "error",
  "errors",
  "reason",
  "description",
  "data",
  "response",
  "content",
  "result",
  "transaction",
  "transactions",
  "details",
]);

function redact(value: string, known: string[]): string {
  let text = value;
  for (const item of known) {
    for (const variant of new Set([item, item.replace(/\D/g, "")])) {
      if (variant.length >= 4) text = text.split(variant).join("[redacted]");
    }
  }
  return text
    .replace(/\b0[789][01]\d{8}\b|\+?234[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[redacted phone]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\b(token|api[_-]?key|authorization|password|secret)\s*[:=]\s*["']?[^,\s"'&}]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function summarise(value: unknown, known: string[], depth = 0): unknown {
  if (typeof value === "string") return redact(value, known);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (!value || typeof value !== "object" || depth >= 3) return "[omitted]";
  if (Array.isArray(value)) return value.slice(0, 3).map((item) => summarise(item, known, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (KEYS.has(key.toLowerCase())) out[key] = summarise(item, known, depth + 1);
  }
  return Object.keys(out).length > 0 ? out : "[response fields omitted]";
}

export function logProviderFailure(
  tag: string,
  reference: string,
  providerId: string,
  result: ProviderResponse,
  outcome: Outcome,
  known: string[],
) {
  console.warn(`${tag} Provider returned a non-success response`, reference, {
    providerId,
    httpStatus: result.status,
    outcome,
    response: summarise(result.data, known),
    more: result.data.detail ?? result.data
  });
}
