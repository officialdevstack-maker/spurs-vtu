import "server-only";
import { getPurchaseMessage } from "@/lib/db/purchase-templates";
import { DEFAULT_MESSAGES, renderMessage, type PurchaseService, type PurchaseStatus } from "@/lib/admin/purchase-templates";

export const refundNote = (refunded: boolean) =>
  refunded
    ? "Your money has been returned to your wallet."
    : "Your refund is being processed and will reach your wallet shortly.";

export async function purchaseMessage(
  service: PurchaseService,
  status: PurchaseStatus,
  vars: Record<string, string>,
): Promise<string> {
  let template = DEFAULT_MESSAGES[service][status];
  try {
    template = (await getPurchaseMessage(service, status)) ?? template;
  } catch (error) {
    console.error("[purchase-messages] Using default message", service, status, error);
  }
  return renderMessage(template, vars);
}
