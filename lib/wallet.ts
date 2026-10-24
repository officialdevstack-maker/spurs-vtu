import "server-only";
import { SpursWallet, SPURS_WALLET_URL } from "@spurs-cloud/wallet";

class WalletRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WalletRequestError";
  }
}

function amountInKobo(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Wallet amounts must be positive and finite.");
  }

  const kobo = Math.round(amount * 100);
  if (!Number.isSafeInteger(kobo) || Math.abs(amount * 100 - kobo) > 1e-6) {
    throw new Error("Wallet amounts must be representable in whole kobo.");
  }
  return kobo;
}

async function postWallet(path: string, body: Record<string, string | number>): Promise<void> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new Error("INTERNAL_API_SECRET must be set before connecting to the wallet.");

  const baseUrl = (process.env.SPURS_WALLET_URL || SPURS_WALLET_URL).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  const text = await response.text();
  let data: unknown = text;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Spurs Wallet request failed (${response.status}).`;
    throw new WalletRequestError(message, response.status);
  }
}

/** The customer's NGN balance in naira, or null if the wallet cannot be reached. */
export async function getNairaBalance(customerId: string): Promise<number | null> {
  try {
    const minorUnits = BigInt(await new SpursWallet().balanceOf(customerId, "NGN"));
    if (minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("Wallet balance exceeds the supported display range.");
    }
    return Number(minorUnits) / 100;
  } catch (error) {
    console.error("[wallet] Could not read balance", error);
    return null;
  }
}

export async function debitWallet(customerId: string, amount: number, reference: string): Promise<boolean> {
  try {
    await postWallet("/api/private/wallet/debit", {
      user: customerId,
      asset: "NGN",
      amount: amountInKobo(amount),
      description: `Spur VTU transaction ${reference}`,
      reference,
    });
    return true;
  } catch (error) {
    if (error instanceof WalletRequestError && error.status === 400 && error.message === "Insufficient balance") {
      return false;
    }
    throw error;
  }
}

/** Credit a purchase refund once; the reference is the wallet service's idempotency key. */
export async function creditWallet(customerId: string, amount: number, reference: string): Promise<boolean> {
  await postWallet("/api/private/wallet/credit", {
    user: customerId,
    asset: "NGN",
    amount: amountInKobo(amount),
    source: "transfer_in",
    reference,
    description: "Spur VTU purchase refund",
  });
  return true;
}
