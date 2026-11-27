import "server-only";
import { getPaymentPointCredentials } from "@/lib/db/payment-providers";

type PaymentPointAccount = {
  accountNumber: string;
  bankName: string;
  accountName: string;
  reservedAccountId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function createPaymentPointAccount(input: {
  email: string;
  name: string;
  phoneNumber: string;
}): Promise<PaymentPointAccount> {
  const credentials = await getPaymentPointCredentials();
  if (!credentials) throw new Error("PaymentPoint is not configured or is disabled.");

  const response = await fetch("https://api.paymentpoint.co/api/v1/createVirtualAccount", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.apiSecret}`,
      "api-key": credentials.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      name: input.name,
      phoneNumber: input.phoneNumber,
      bankCode: ["20946", "20897"],
      businessId: credentials.businessId,
    }),
    signal: AbortSignal.timeout(15000),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("PaymentPoint returned an invalid response.");
  }

  const body = asRecord(payload);
  const bankAccounts = Array.isArray(body?.bankAccounts) ? body.bankAccounts : [];
  const account = asRecord(bankAccounts[0]);
  const accountNumber = account?.accountNumber;
  const bankName = account?.bankName;
  const accountName = account?.accountName;
  const reservedAccountId = account?.Reserved_Account_Id;
  if (
    !response.ok ||
    body?.status !== "success" ||
    typeof accountNumber !== "string" ||
    !/^\d{8,20}$/.test(accountNumber) ||
    typeof bankName !== "string" ||
    !bankName.trim()
  ) {
    throw new Error("PaymentPoint did not create a usable virtual account.");
  }

  return {
    accountNumber,
    bankName: bankName.trim(),
    accountName: typeof accountName === "string" ? accountName : "",
    reservedAccountId: typeof reservedAccountId === "string" ? reservedAccountId : null,
  };
}
