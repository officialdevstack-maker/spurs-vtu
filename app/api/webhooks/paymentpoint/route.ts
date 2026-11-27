import { createHmac, timingSafeEqual } from "node:crypto";
import { applyPaymentPointPayment } from "@/lib/db/wallet";
import { getPaymentPointCredentials } from "@/lib/db/payment-providers";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validSignature(body: Buffer, received: string | null, secret: string): boolean {
  if (!received || !/^[a-f\d]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  let credentials;
  try {
    credentials = await getPaymentPointCredentials(true);
  } catch (error) {
    console.error(
      "[paymentpoint-webhook] Could not load webhook credentials",
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response("PaymentPoint webhook is unavailable", { status: 503 });
  }
  if (!credentials) return new Response("PaymentPoint is not configured", { status: 503 });

  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!validSignature(rawBody, request.headers.get("paymentpoint-signature"), credentials.webhookSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = asRecord(payload);
  if (event?.notification_status !== "payment_successful" || event?.transaction_status !== "success") {
    return Response.json({ received: true });
  }

  const rawTransactionId = event.transaction_id;
  const transactionId =
    typeof rawTransactionId === "string"
      ? rawTransactionId.trim()
      : typeof rawTransactionId === "number" && Number.isSafeInteger(rawTransactionId)
        ? String(rawTransactionId)
        : "";
  const receiver = asRecord(event.receiver);
  const accountNumber = receiver?.account_number;
  const amount = event.amount_paid;
  if (
    !transactionId ||
    transactionId.length > 200 ||
    typeof accountNumber !== "string" ||
    !/^\d{8,20}$/.test(accountNumber) ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return new Response("Invalid payment details", { status: 400 });
  }

  const amountKobo = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountKobo) || Math.abs(amount * 100 - amountKobo) > 1e-6) {
    return new Response("Invalid payment amount", { status: 400 });
  }

  try {
    const result = await applyPaymentPointPayment({ transactionId, accountNumber, amountKobo });
    if (result === "not_found") {
      console.warn("[paymentpoint-webhook] Payment did not match a funding account", { transactionId });
    } else if (result === "needs_review") {
      console.warn("[paymentpoint-webhook] Deposit held for admin review", { transactionId });
    }
    return Response.json({ received: true, result });
  } catch (error) {
    console.error(
      "[paymentpoint-webhook] Could not apply payment",
      transactionId,
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response("Webhook processing failed", { status: 500 });
  }
}
