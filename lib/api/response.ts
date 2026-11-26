import "server-only";

export function apiOk(data: unknown, status = 200): Response {
  return Response.json({ ok: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(code: string, message: string, status: number, headers: HeadersInit = {}): Response {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
