import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { firstName, type PurchaseService } from "@/lib/admin/purchase-templates";
import type { ProviderService } from "@/lib/admin/providers";
import type { PurchaseResult } from "@/lib/data-purchase";
import { getCustomerForPurchase } from "@/lib/db/data-purchase";
import { findTransaction, finishTransaction, markDebited, startTransaction } from "@/lib/db/transactions";
import { formatNaira } from "@/lib/format";
import { notify } from "@/lib/notify";
import { quoteCharge, refundAndMark, takePayment } from "@/lib/payment";
import { logProviderFailure } from "@/lib/purchase/diagnostics";
import { NotSentError, callProviderEndpoint, type ProviderResponse } from "@/lib/providers/call";
import type { Vars } from "@/lib/providers/fill";
import { interpretProviderResponse, type Outcome } from "@/lib/providers/result";
import { purchaseMessage, refundNote } from "@/lib/purchase-messages";
import { onPurchaseSuccess } from "@/lib/rewards";
import { getNairaBalance } from "@/lib/wallet";
import { verifyPin } from "@/lib/db/pin";
import { recordAttempt, switchProvider, type Route } from "@/lib/db/failover";
import { screenPurchase } from "@/lib/fraud";

export const REFERENCE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const INVALID_PURCHASE = "That purchase isn't valid. Refresh the page and try again.";
export const BAD_PHONE = "Enter an 11-digit phone number, like 0803 123 4567.";
const NO_PAYMENT = "We couldn't take payment from your wallet. Check your balance and try again.";

export const purchaseFail = (error: string): PurchaseResult => ({ ok: false, error });

const COPY: Record<PurchaseService, { done: string; pending: string; rejected: string; balanceHint: string }> = {
  airtime: {
    done: "was delivered",
    pending: "Your order is being confirmed with the network. Your payment is held, and the status will update in your history.",
    rejected: "The network couldn't deliver this airtime.",
    balanceHint: "buy this airtime",
  },
  data: {
    done: "was delivered",
    pending: "Your order is being confirmed with the network. Your payment is held, and the status will update in your history.",
    rejected: "The network couldn't deliver this plan.",
    balanceHint: "buy this plan",
  },
  cable: {
    done: "was renewed",
    pending: "Your renewal is being confirmed with the provider. Your payment is held, and the status will update in your history.",
    rejected: "The provider couldn't renew this subscription.",
    balanceHint: "renew this bouquet",
  },
  electricity: {
    done: "was delivered",
    pending: "Your order is being confirmed with the distribution company. Your payment is held, and the status will update in your history.",
    rejected: "The distribution company couldn't process this payment.",
    balanceHint: "buy this electricity",
  },
};

type PurchaseCustomer = NonNullable<Awaited<ReturnType<typeof getCustomerForPurchase>>>;

export async function openPurchase(
  service: PurchaseService,
  customerId: string,
  reference: string,
  pin: unknown,
): Promise<{ result: PurchaseResult } | { customer: PurchaseCustomer }> {
  const existing = await findTransaction(reference, customerId);
  if (existing) {
    const copy = COPY[service];
    if (existing.status === "success") {
      return { result: { ok: true, status: "success", message: `${existing.title} ${copy.done}.` } };
    }
    if (existing.status === "pending") return { result: { ok: true, status: "pending", message: copy.pending } };
    return { result: purchaseFail(existing.failureReason ?? "That purchase failed.") };
  }

  const checked = await verifyPin(customerId, pin);
  if (!checked.ok) return { result: { ok: false, error: checked.error, pin: true } };

  const customer = await getCustomerForPurchase(customerId);
  if (!customer) return { result: purchaseFail("We couldn't find your account. Refresh the page and try again.") };
  if (customer.status === "suspended") {
    return { result: purchaseFail("Your account is suspended. Contact support to make purchases.") };
  }
  return { customer };
}

export type PurchaseSpec = {
  service: PurchaseService;
  reference: string;
  user: { sub: string; name?: string | null };
  useCashback: boolean;
  price: number;
  cost: number | null;
  title: string;
  detail: string;
  networkId: string | null;
  planId: string | null;
  providerId: string;
  phone: string;
  recipient: string;
  providerService: ProviderService;
  providerVars: Vars;
  alternates?: Route[];
  inspect?: (result: ProviderResponse) => Record<string, string> | void;
};

export async function executePurchase(spec: PurchaseSpec): Promise<PurchaseResult> {
  const { service, reference, user } = spec;
  const copy = COPY[service];
  const tag = `[${service}-purchase]`;

  const screened = await screenPurchase({ customerId: user.sub, price: spec.price, reference });
  if (!screened.allow) return purchaseFail(screened.message);

  const charge = await quoteCharge(user.sub, spec.price, spec.useCashback);
  const balance = await getNairaBalance(user.sub);
  if (balance !== null && balance < charge.walletPart) {
    return purchaseFail(
      `Your wallet balance is ${formatNaira(balance)}. Fund your wallet or use cashback to ${copy.balanceHint}.`,
    );
  }

  const started = await startTransaction({
    id: reference,
    customerId: user.sub,
    service,
    title: spec.title,
    detail: spec.detail,
    amount: spec.price,
    cost: spec.cost,
    networkId: spec.networkId,
    planId: spec.planId,
    providerId: spec.providerId,
    phone: spec.phone,
    cashbackUsed: charge.cashbackUsed,
  });
  if (!started) return purchaseFail("That purchase is already being processed. Check your history.");

  const vars = {
    name: firstName(user.name),
    item: spec.title,
    amount: formatNaira(spec.price),
    recipient: spec.recipient,
  };

  let debited = false;
  try {
    debited = await takePayment(user.sub, charge, reference);
  } catch (error) {
    console.error(`${tag} Wallet debit status unknown`, reference, error);
    try {
      await finishTransaction(reference, "pending", { reason: "Wallet debit status unknown" });
    } catch (updateError) {
      console.error(`${tag} Could not record unknown wallet debit status`, reference, updateError);
    }
    return purchaseFail("Something went wrong with your wallet. Check your balance and history before trying again.");
  }

  if (!debited) {
    await finishTransaction(reference, "failed", { reason: NO_PAYMENT });
    return purchaseFail(NO_PAYMENT);
  }

  try {
    await markDebited(reference);
  } catch (error) {
    console.error(`${tag} Wallet debited but could not set debited flag`, reference, error);
  }

  let outcome: Outcome = "pending";
  let response: string | undefined;
  let extra: Record<string, string> = {};
  const routes: Route[] = [
    { providerId: spec.providerId, vars: spec.providerVars, cost: spec.cost },
    ...(spec.alternates ?? []),
  ];

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    if (i > 0) {
      try {
        await switchProvider(reference, route.providerId, route.cost);
      } catch (error) {
        console.error(`${tag} Could not switch provider, stopping failover`, reference, error);
        break;
      }
    }

    let attempt: "success" | "failed" | "pending" | "not_sent";
    let httpStatus: number | null = null;
    try {
      const result = await callProviderEndpoint(route.providerId, spec.providerService, route.vars);
      httpStatus = result.status;
      outcome = interpretProviderResponse(result);
      attempt = outcome;
      response = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
      try {
        extra = spec.inspect?.(result) ?? {};
      } catch (error) {
        console.error(`${tag} Could not read the provider reply`, reference, error);
      }
      if (outcome !== "success") {
        logProviderFailure(tag, reference, route.providerId, result, outcome, [spec.phone, spec.recipient]);
      }
    } catch (error) {
      response = error instanceof Error ? error.message : "Provider call failed";
      const notSent = error instanceof NotSentError;
      outcome = notSent ? "failed" : "pending";
      attempt = notSent ? "not_sent" : "pending";
      console.error(`${tag} Provider call did not complete`, reference, error);
    }

    await recordAttempt({
      transactionId: reference,
      attempt: i + 1,
      providerId: route.providerId,
      outcome: attempt,
      httpStatus,
    }).catch((error) => console.error(`${tag} Could not record attempt`, reference, error));

    if (outcome !== "failed") break;
  }

  if (outcome === "success") {
    await finishTransaction(reference, "success", { response });
    await onPurchaseSuccess(reference);
    after(() =>
      notify(user.sub, {
        id: `tx-${reference}`,
        category: "transaction",
        title: "Purchase successful",
        body: `${spec.title} ${copy.done}.`,
        url: `/dashboard/transactions/${reference}`,
      }),
    );
    revalidatePath("/dashboard");
    return { ok: true, status: "success", message: await purchaseMessage(service, "success", { ...vars, ...extra }) };
  }

  if (outcome === "failed") {
    await finishTransaction(reference, "failed", { reason: copy.rejected, response });
    const refunded = await refundAndMark(user.sub, spec.price, charge.cashbackUsed, reference);
    after(() =>
      notify(user.sub, {
        id: `tx-${reference}`,
        category: "transaction",
        title: "Purchase failed",
        body: `${spec.title}: ${copy.rejected} ${refundNote(refunded)}`,
        url: `/dashboard/transactions/${reference}`,
      }),
    );
    revalidatePath("/dashboard");
    return purchaseFail(await purchaseMessage(service, "failed", { ...vars, refund_note: refundNote(refunded) }));
  }

  await finishTransaction(reference, "pending", { response });
  revalidatePath("/dashboard");
  return { ok: true, status: "pending", message: await purchaseMessage(service, "pending", vars) };
}
