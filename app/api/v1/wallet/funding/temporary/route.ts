import { randomUUID } from "node:crypto";
import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import {
  createPaymentPointFundingIntent,
  failPaymentPointFundingIntent,
  savePaymentPointFundingIntentAccount,
} from "@/lib/db/wallet";
import { getPool } from "@/lib/db";
import {
  createPaymentPointTemporaryAccount,
  PaymentPointApiError,
} from "@/lib/paymentpoint";

function logPaymentPointError(context: string, error: unknown): void {
  if (error instanceof PaymentPointApiError) {
    console.error(context, { status: error.status, providerMessage: error.providerMessage });
  } else {
    console.error(
      context,
      error instanceof Error ? { name: error.name, message: error.message } : "Unknown error",
    );
  }
}

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const amount = body?.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 100 || amount > 1_000_000) {
    return apiError("invalid_request", "Enter a funding amount from ₦100 to ₦1,000,000.", 400);
  }
  const amountKobo = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountKobo) || Math.abs(amount * 100 - amountKobo) > 1e-6) {
    return apiError("invalid_request", "The amount must be in whole kobo.", 400);
  }
  try {
    const { rows } = await getPool().query<{
      email: string | null;
      name: string | null;
      phone: string | null;
    }>(
      "select email, name, phone from customers where id = $1",
      [auth.ctx.customerId],
    );
    const customer = rows[0];
    if (!customer?.email) return apiError("invalid_request", "Add an email address before creating an account.", 400);
    const phoneNumber = customer.phone?.trim();
    if (!phoneNumber) {
      return apiError("invalid_request", "Add a phone number before creating a one-time account.", 400);
    }
    const name = (auth.ctx.customerName?.trim() || customer.name?.trim() || "Spurs customer").slice(0, 100);
    const reference = randomUUID();
    const intent = await createPaymentPointFundingIntent({
      reference,
      customerId: auth.ctx.customerId,
      amountKobo,
    });
    let details: Awaited<ReturnType<typeof createPaymentPointTemporaryAccount>>;
    try {
      details = await createPaymentPointTemporaryAccount({
        email: customer.email,
        name,
        phoneNumber,
        amount: amountKobo / 100,
      });
    } catch (error) {
      try {
        await failPaymentPointFundingIntent(intent.reference, auth.ctx.customerId);
      } catch (cleanupError) {
        logPaymentPointError("[api] failed to mark PaymentPoint funding intent failed", cleanupError);
      }
      logPaymentPointError("[api] PaymentPoint temporary funding failed", error);
      return apiError("server_error", "We couldn't create a temporary account.", 500);
    }

    const saved = await savePaymentPointFundingIntentAccount({
      reference: intent.reference,
      customerId: auth.ctx.customerId,
      accountNumber: details.accountNumber,
      bankName: details.bankName,
    });
    return apiOk({
      accountNumber: saved.accountNumber,
      bankName: saved.bankName,
      accountName: details.accountName || name,
      amount: saved.amountKobo / 100,
      reference: saved.reference,
      expiresAt: null,
    });
  } catch (error) {
    logPaymentPointError("[api] temporary funding", error);
    return apiError("server_error", "We couldn't create a temporary account.", 500);
  }
}
