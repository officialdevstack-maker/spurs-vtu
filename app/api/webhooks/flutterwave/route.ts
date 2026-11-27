import { timingSafeEqual } from "node:crypto";
import { applyFlutterwavePayment } from "@/lib/db/wallet";
import { getFlutterwave, getFlutterwaveWebhookHash } from "@/lib/flutterwave";

function sameSecret(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function POST(request: Request) {
  let webhookHash: string | null;
  try {
    webhookHash = await getFlutterwaveWebhookHash();
  } catch (error) {
    console.error(
      "[flutterwave-webhook] Could not load webhook credentials",
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response("Flutterwave webhook is unavailable", { status: 503 });
  }
  if (!webhookHash) return new Response("Flutterwave is not configured", { status: 503 });
  if (!sameSecret(request.headers.get("verif-hash"), webhookHash)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = asRecord(payload);
  const eventData = asRecord(event?.data);
  if (event?.event !== "charge.completed" || !eventData) {
    return Response.json({ received: true });
  }
  const rawId = eventData.id;
  const transactionId = typeof rawId === "number" ? rawId : Number(rawId);
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
    return new Response("Invalid transaction id", { status: 400 });
  }

  try {
    const flw = await getFlutterwave(true);
    const verification = asRecord(await flw.Transaction.verify({ id: transactionId }));
    const verifiedData = asRecord(verification?.data);
    if (
      verification?.status !== "success" ||
      !verifiedData ||
      verifiedData.status !== "successful" ||
      verifiedData.currency !== "NGN" ||
      String(verifiedData.id) !== String(transactionId)
    ) {
      return Response.json({ received: true, verified: false });
    }

    const rawReference = verifiedData.tx_ref;
    const rawAmount = verifiedData.amount;
    if (
      typeof rawReference !== "string" ||
      !rawReference ||
      typeof rawAmount !== "number" ||
      !Number.isFinite(rawAmount) ||
      rawAmount <= 0
    ) {
      return Response.json({ received: true, verified: false });
    }

    const amountKobo = Math.round(rawAmount * 100);
    if (!Number.isSafeInteger(amountKobo) || Math.abs(rawAmount * 100 - amountKobo) > 1e-6) {
      return Response.json({ received: true, verified: false });
    }

    const result = await applyFlutterwavePayment({
      transactionId: String(transactionId),
      reference: rawReference,
      amountKobo,
    });
    if (result === "not_found") {
      console.warn("[flutterwave-webhook] Payment did not match a funding request", {
        transactionId,
        result,
      });
    } else if (result === "needs_review") {
      console.warn("[flutterwave-webhook] Deposit held for admin review", { transactionId });
    }
    return Response.json({ received: true, result });
  } catch (error) {
    console.error(
      "[flutterwave-webhook] Could not verify or credit transaction",
      transactionId,
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response("Webhook processing failed", { status: 500 });
  }
}
