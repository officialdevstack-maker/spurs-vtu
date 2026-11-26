import { randomUUID } from "node:crypto";
import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { getPool } from "@/lib/db";
import { accountDetails, getFlutterwave } from "@/lib/flutterwave";
import { createFundingIntent, saveFundingIntentAccount } from "@/lib/db/wallet";

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
    const { rows } = await getPool().query<{ email: string | null; name: string | null }>(
      "select email, name from customers where id = $1",
      [auth.ctx.customerId],
    );
    const customer = rows[0];
    if (!customer?.email) return apiError("invalid_request", "Add an email address before creating an account.", 400);
    const reference = randomUUID();
    const intent = await createFundingIntent({ reference, customerId: auth.ctx.customerId, amountKobo });
    const flutterwave = await getFlutterwave();
    const response = await flutterwave.VirtualAcct.create({
      email: customer.email,
      is_permanent: false,
      amount: amountKobo / 100,
      tx_ref: reference,
      narration: customer.name ?? "Spur VTU customer",
    });
    const details = accountDetails(response);
    const saved = await saveFundingIntentAccount({
      reference: intent.reference,
      customerId: auth.ctx.customerId,
      accountNumber: details.accountNumber,
      bankName: details.bankName,
      expiresAt: details.expiresAt,
    });
    return apiOk({
      accountNumber: saved.accountNumber,
      bankName: saved.bankName,
      accountName: customer.name ?? "Spur VTU customer",
      amount: saved.amountKobo / 100,
      reference: saved.reference,
      expiresAt: saved.expiresAt,
    });
  } catch (error) {
    console.error("[api] temporary funding");
    return apiError("server_error", "We couldn't create a temporary account.", 500);
  }
}
