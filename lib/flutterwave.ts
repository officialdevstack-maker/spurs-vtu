import "server-only";
import Flutterwave from "flutterwave-node-v3";
import { getFlutterwaveCredentials } from "@/lib/db/payment-providers";

export async function getFlutterwave(includeDisabled = false): Promise<Flutterwave> {
  const credentials = await getFlutterwaveCredentials(includeDisabled);
  if (!credentials) throw new Error("Flutterwave is not configured or is disabled.");
  return new Flutterwave(credentials.publicKey, credentials.secretKey);
}

export async function getFlutterwaveWebhookHash(): Promise<string | null> {
  const credentials = await getFlutterwaveCredentials(true);
  return credentials?.webhookHash ?? null;
}

export function accountDetails(response: unknown): {
  accountNumber: string;
  bankName: string;
  accountName: string;
  expiresAt: string | null;
} {
  if (!response || typeof response !== "object" || !("data" in response)) {
    throw new Error("Flutterwave returned an invalid virtual account response.");
  }
  const { status, data } = response as { status?: unknown; data?: unknown };
  if (status !== "success" || !data || typeof data !== "object") {
    throw new Error("Flutterwave did not create the virtual account.");
  }
  const details = data as Record<string, unknown>;
  const accountNumber = details.account_number;
  const bankName = details.bank_name;
  const accountName = details.account_name;
  if (
    typeof accountNumber !== "string" ||
    !/^\d{8,20}$/.test(accountNumber) ||
    typeof bankName !== "string" ||
    bankName.length === 0
  ) {
    throw new Error("Flutterwave returned incomplete virtual account details.");
  }
  const expiryDate =
    typeof details.expiry_date === "string" && !["N/A", "na", ""].includes(details.expiry_date)
      ? new Date(details.expiry_date)
      : null;
  return {
    accountNumber,
    bankName,
    accountName: typeof accountName === "string" && accountName ? accountName : "",
    expiresAt: expiryDate && !Number.isNaN(expiryDate.getTime()) ? expiryDate.toISOString() : null,
  };
}
