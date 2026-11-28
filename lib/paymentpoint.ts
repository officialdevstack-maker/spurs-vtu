import "server-only";
import { getPaymentPointCredentials } from "@/lib/db/payment-providers";

type PaymentPointAccount = {
  accountNumber: string;
  bankName: string;
  accountName: string;
  reservedAccountId: string | null;
};

type PaymentPointAccountInput = {
  email: string;
  name: string;
  phoneNumber: string;
};

export class PaymentPointApiError extends Error {
  constructor(
    readonly status: number,
    readonly providerMessage: string,
  ) {
    super(`PaymentPoint API returned HTTP ${status}: ${providerMessage}`);
    this.name = "PaymentPointApiError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function accountDetails(value: unknown): PaymentPointAccount | null {
  const account = asRecord(value);
  const accountNumber = account?.accountNumber;
  const bankName = account?.bankName;
  const accountName = account?.accountName;
  const reservedAccountId = account?.Reserved_Account_Id;
  if (
    typeof accountNumber !== "string" ||
    !/^\d{8,20}$/.test(accountNumber) ||
    typeof bankName !== "string" ||
    !bankName.trim()
  ) {
    return null;
  }
  return {
    accountNumber,
    bankName: bankName.trim(),
    accountName: typeof accountName === "string" ? accountName : "",
    reservedAccountId: typeof reservedAccountId === "string" ? reservedAccountId : null,
  };
}

function errorText(value: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.slice(0, 8).flatMap((item) => errorText(item, depth + 1));
  const record = asRecord(value);
  if (!record) return [];
  const knownFields = ["message", "error", "detail", "errors", "code"];
  const knownValues = knownFields.flatMap((field) => errorText(record[field], depth + 1));
  if (knownValues.length > 0) return knownValues;
  return Object.values(record).slice(0, 8).flatMap((item) => errorText(item, depth + 1));
}

function safeProviderMessage(body: unknown, responseText: string, secrets: readonly string[]): string {
  const message = errorText(body).join("; ") || responseText || "No error details were returned.";
  let safeMessage = message.replace(/[\r\n\t]+/g, " ").trim();
  for (const secret of secrets) {
    if (secret) safeMessage = safeMessage.split(secret).join("[redacted]");
  }
  safeMessage = safeMessage
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, "[redacted number]");
  return safeMessage.slice(0, 500);
}

function bankAccountsFrom(
  body: Record<string, unknown> | null,
): { raw: unknown; accounts: unknown[] } {
  const data = asRecord(body?.data);
  const raw = body?.bankAccounts ?? data?.bankAccounts;
  const accounts = Array.isArray(raw)
    ? raw
    : raw === undefined || raw === null
      ? []
      : [raw];
  return { raw, accounts };
}

function responseShape(
  body: Record<string, unknown> | null,
  secrets: readonly string[],
): string {
  const data = asRecord(body?.data);
  const { raw: rawBankAccounts, accounts: bankAccounts } = bankAccountsFrom(body);
  const firstAccount = asRecord(bankAccounts[0]);
  const providerErrors = errorText(body?.errors);
  return [
    `provider status: ${typeof body?.status === "string" ? body.status : "not present"}`,
    `response keys: ${Object.keys(body ?? {}).slice(0, 20).join(",") || "none"}`,
    `bankAccounts type: ${Array.isArray(rawBankAccounts) ? "array" : typeof rawBankAccounts}`,
    `bankAccounts count: ${bankAccounts.length}`,
    `first account keys: ${Object.keys(firstAccount ?? {}).slice(0, 20).join(",") || "none"}`,
    `data keys: ${Object.keys(data ?? {}).slice(0, 20).join(",") || "none"}`,
    `provider errors: ${
      providerErrors.length > 0 ? safeProviderMessage(body?.errors, "", secrets) : "none returned"
    }`,
  ].join("; ");
}

async function createVirtualAccount(
  input: PaymentPointAccountInput,
  amount?: number,
): Promise<PaymentPointAccount> {
  const credentials = await getPaymentPointCredentials();
  if (!credentials) throw new Error("PaymentPoint is not configured or is disabled.");

  const secrets = [
    credentials.apiKey,
    credentials.apiSecret,
    credentials.businessId,
    input.email,
    input.name,
    input.phoneNumber,
  ];
  const dynamic = amount !== undefined;
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
      bankCode: dynamic ? ["20897"] : ["20946", "20897"],
      businessId: credentials.businessId,
      ...(dynamic ? { accountType: "dynamic", amount } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });

  let responseText: string;
  try {
    responseText = (await response.text()).slice(0, 4096);
  } catch {
    throw new PaymentPointApiError(response.status, "Could not read the response body.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new PaymentPointApiError(
      response.status,
      safeProviderMessage(null, responseText, secrets),
    );
  }

  const body = asRecord(payload);
  const account = bankAccountsFrom(body).accounts
    .map(accountDetails)
    .find((details) => details !== null);
  if (!response.ok || !account) {
    throw new PaymentPointApiError(
      response.status,
      `${safeProviderMessage(body, responseText, secrets)}; ${responseShape(body, secrets)}`,
    );
  }

  if (errorText(body?.errors).length > 0) {
    console.warn("[paymentpoint] Account created with provider warnings", {
      status: response.status,
      providerMessage: safeProviderMessage(body?.errors, "", secrets),
    });
  }
  return account;
}

export async function createPaymentPointAccount(
  input: PaymentPointAccountInput,
): Promise<PaymentPointAccount> {
  return createVirtualAccount(input);
}

export async function createPaymentPointTemporaryAccount(
  input: PaymentPointAccountInput & { amount: number },
): Promise<PaymentPointAccount> {
  return createVirtualAccount(input, input.amount);
}
