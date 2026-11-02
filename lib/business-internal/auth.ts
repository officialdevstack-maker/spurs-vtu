import "server-only";

import { timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isBusinessInternalRequest(request: Request): boolean {
  const expected = process.env.BUSINESS_INTERNAL_API_SECRET;
  const provided = request.headers.get("x-business-internal-secret") ?? "";
  if (!expected) {
    console.error("BUSINESS_INTERNAL_API_SECRET is not configured; rejecting request.");
    return false;
  }
  return Boolean(provided) && safeEqual(provided, expected);
}
