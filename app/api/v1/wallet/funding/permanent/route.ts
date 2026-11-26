import { randomUUID } from "node:crypto";
import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { accountDetails, getFlutterwave } from "@/lib/flutterwave";
import { getFlutterwaveAccount, reserveFlutterwaveAccount, saveFlutterwaveAccount } from "@/lib/db/wallet";
import { getPool } from "@/lib/db";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const bvn = body?.bvn;
  if (typeof bvn !== "string" || !/^\d{11}$/.test(bvn)) {
    return apiError("invalid_request", "Enter the 11-digit BVN belonging to your account.", 400);
  }
  try {
    const { rows } = await getPool().query<{ email: string | null; name: string | null }>(
      "select email, name from customers where id = $1",
      [auth.ctx.customerId],
    );
    const customer = rows[0];
    if (!customer?.email) return apiError("invalid_request", "Add an email address before creating a permanent account.", 400);
    const existing = await getFlutterwaveAccount(auth.ctx.customerId);
    if (existing?.status === "active") {
      return apiOk({ accountNumber: existing.accountNumber, bankName: existing.bankName, accountName: existing.accountName });
    }
    const reserved = await reserveFlutterwaveAccount(auth.ctx.customerId, existing?.txRef ?? randomUUID());
    const flutterwave = await getFlutterwave();
    const response = await flutterwave.VirtualAcct.create({
      email: customer.email,
      is_permanent: true,
      bvn,
      tx_ref: reserved.txRef,
      narration: auth.ctx.customerName ?? "Spur VTU customer",
    });
    const details = accountDetails(response);
    const account = await saveFlutterwaveAccount({
      customerId: auth.ctx.customerId,
      txRef: reserved.txRef,
      accountNumber: details.accountNumber,
      bankName: details.bankName,
      accountName: details.accountName,
    });
    return apiOk({ accountNumber: account.accountNumber, bankName: account.bankName, accountName: account.accountName });
  } catch (error) {
    console.error("[api] permanent funding");
    return apiError("server_error", "We couldn't create your permanent account.", 500);
  }
}
