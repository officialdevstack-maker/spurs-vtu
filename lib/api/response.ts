import "server-only";

const MAX_JSON_BYTES = 32_000;

export function requestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim().slice(0, 100) ||
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function apiOk(data: unknown, status = 200, requestIdValue?: string): Response {
  const id = requestIdValue;
  return Response.json(
    id ? { ok: true, data, requestId: id } : { ok: true, data },
    { status, headers: { "Cache-Control": "no-store", ...(id ? { "X-Request-Id": id } : {}) } },
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
  headers: HeadersInit = {},
  requestIdValue?: string,
): Response {
  const id = requestIdValue;
  return Response.json(
    id ? { ok: false, error: { code, message }, requestId: id } : { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store", ...(id ? { "X-Request-Id": id } : {}), ...headers } },
  );
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > MAX_JSON_BYTES) return null;
  try {
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES) return null;
    const body: unknown = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
