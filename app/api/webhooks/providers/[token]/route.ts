import { NextResponse, type NextRequest } from "next/server";
import { getProviderByToken, logWebhookEvent } from "@/lib/db/webhooks";
import { settleFromWebhook } from "@/lib/settlement";
import { interpretProviderResponse } from "@/lib/providers/result";

const MAX_BODY = 20_000;
const REFERENCE_KEYS = [
  "reference",
  "ref",
  "request_id",
  "requestId",
  "client_reference",
  "transaction_reference",
  "trx_ref",
  "order_id",
  "orderId",
];

type Payload = Record<string, unknown>;

async function readText(
  request: NextRequest,
): Promise<{ text: string } | { error: "large" | "invalid" }> {
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > MAX_BODY) return { error: "large" };
  if (!request.body) return { text: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY) {
        await reader.cancel();
        return { error: "large" };
      }
      text += decoder.decode(value, { stream: true });
    }
    return { text: text + decoder.decode() };
  } catch (error) {
    if (error instanceof TypeError) return { error: "invalid" };
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function readPayload(request: NextRequest): Promise<{ payload?: Payload; error?: "large" | "invalid" }> {
  const payload: Payload = Object.fromEntries(request.nextUrl.searchParams);
  if (request.method !== "POST") return { payload };

  const body = await readText(request);
  if ("error" in body) return { error: body.error };
  const { text } = body;
  if (!text) return { payload };

  try {
    if ((request.headers.get("content-type") ?? "").toLowerCase().includes("application/x-www-form-urlencoded")) {
      Object.assign(payload, Object.fromEntries(new URLSearchParams(text)));
    } else {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { error: "invalid" };
      Object.assign(payload, parsed);
    }
  } catch (error) {
    if (error instanceof SyntaxError) return { error: "invalid" };
    throw error;
  }
  return { payload };
}

function findReference(data: unknown, depth = 0): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data) || depth > 2) return null;
  const record = data as Payload;
  for (const key of REFERENCE_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim() && value.trim().length <= 200) return value.trim();
    if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  }
  return findReference(record.data, depth + 1);
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function handle(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let provider: Awaited<ReturnType<typeof getProviderByToken>>;
  try {
    provider = await getProviderByToken(token);
  } catch (error) {
    console.error("[webhook] Could not find callback provider", error);
    return json({ error: "Could not process the callback" }, 500);
  }
  if (!provider) return json({ error: "Not found" }, 404);

  try {
    const parsed = await readPayload(request);
    if (parsed.error === "large") return json({ error: "Payload too large" }, 413);
    if (parsed.error === "invalid" || !parsed.payload) return json({ error: "Invalid callback payload" }, 400);

    const payload = parsed.payload;
    const reference = findReference(payload);
    const outcome = interpretProviderResponse({ ok: true, status: 200, data: payload });
    const raw = JSON.stringify(payload);

    if (!reference) {
      await logWebhookEvent({ providerId: provider.id, reference: null, outcome, result: "ignored", payload: raw });
      return json({ received: true, applied: false, reason: "No reference found in the payload." });
    }

    const result = await settleFromWebhook({ providerId: provider.id, reference, outcome, response: raw });
    await logWebhookEvent({ providerId: provider.id, reference, outcome, result, payload: raw });
    return json({ received: true, applied: result === "applied", result });
  } catch (error) {
    console.error("[webhook] Failed to process callback", provider.id, error);
    return json({ error: "Could not process the callback" }, 500);
  }
}

export const POST = handle;
export const GET = handle;
