import type { ResponseField, ResponseMap } from "@/lib/admin/providers";

export function readPath(data: unknown, path: string): unknown {
  let current = data;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function toText(value: unknown, max = 200): string | null {
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    return text ? text.slice(0, max) : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function toAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const amount = Number(value.replace(/[₦,\s]/g, ""));
    return Number.isFinite(amount) ? amount : null;
  }
  return null;
}

type Mapped = { data: unknown; map?: ResponseMap };

export const mappedValue = (r: Mapped, field: ResponseField): unknown =>
  r.map?.[field] ? readPath(r.data, r.map[field]) : undefined;
export const mappedText = (r: Mapped, field: ResponseField) => toText(mappedValue(r, field));
export const mappedAmount = (r: Mapped, field: ResponseField) => toAmount(mappedValue(r, field));

const NAME_KEYS = ["customer_name", "customerName", "Customer_Name", "account_name", "accountName", "full_name", "fullName", "name"];

export function findName(data: unknown, depth = 0): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data) || depth > 2) return null;
  const record = data as Record<string, unknown>;
  for (const key of NAME_KEYS) {
    const name = toText(record[key], 80);
    if (name) return name;
  }
  return findName(record.data, depth + 1) ?? findName(record.content, depth + 1);
}
