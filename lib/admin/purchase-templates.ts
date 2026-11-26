export type PurchaseService = "airtime" | "data" | "cable" | "electricity";
export type PurchaseStatus = "success" | "pending" | "failed";
export type PurchaseTemplate = {
  id: string;
  name: string;
  service: PurchaseService;
  status: PurchaseStatus;
  message: string;
  /** The live template for its service and status. Only one can be live. */
  active: boolean;
};
export type PurchaseTemplateFields = Omit<PurchaseTemplate, "id">;

export const NAME_LIMIT = 60;
export const MAX_TEMPLATES = 100;

export const PURCHASE_SERVICES: { id: PurchaseService; label: string }[] = [
  { id: "airtime", label: "Airtime" },
  { id: "data", label: "Data" },
  { id: "cable", label: "Cable TV" },
  { id: "electricity", label: "Electricity" },
];

export const PURCHASE_STATUSES: { id: PurchaseStatus; label: string; hint: string }[] = [
  { id: "success", label: "Successful", hint: "Shown when the order is delivered." },
  { id: "pending", label: "Pending", hint: "Shown while the provider is still confirming." },
  { id: "failed", label: "Failed", hint: "Shown when the order is rejected." },
];

export const isPurchaseService = (value: unknown): value is PurchaseService =>
  PURCHASE_SERVICES.some((service) => service.id === value);
export const isPurchaseStatus = (value: unknown): value is PurchaseStatus =>
  PURCHASE_STATUSES.some((status) => status.id === value);

export const MESSAGE_LIMIT = 300;

export const DEFAULT_MESSAGES: Record<PurchaseService, Record<PurchaseStatus, string>> = {
  airtime: {
    success: "{item} sent to {recipient}.",
    pending: "Your order is being confirmed with the network. Your payment is held, and the status will update in your history.",
    failed: "The network couldn't deliver this airtime. {refund_note}",
  },
  data: {
    success: "{item} sent to {recipient}.",
    pending: "Your order is being confirmed with the network. Your payment is held, and the status will update in your history.",
    failed: "The network couldn't deliver this plan. {refund_note}",
  },
  cable: {
    success: "{item} renewed for decoder {recipient}.",
    pending: "Your renewal is being confirmed with the provider. Your payment is held, and the status will update in your history.",
    failed: "The provider couldn't renew this subscription. {refund_note}",
  },
  electricity: {
    success: "{item} paid for meter {recipient}.{token_note}",
    pending: "Your order is being confirmed with the distribution company. Your payment is held, and the status will update in your history.",
    failed: "The distribution company couldn't process this payment. {refund_note}",
  },
};

const RECIPIENT_HINT: Record<PurchaseService, string> = {
  airtime: "The phone number topped up",
  data: "The phone number that got the data",
  cable: "The decoder or smartcard number",
  electricity: "The meter number",
};

export function placeholdersFor(service: PurchaseService, status: PurchaseStatus): { key: string; hint: string }[] {
  const list = [
    { key: "name", hint: "Customer's first name" },
    { key: "item", hint: "What was bought, e.g. 2GB MTN SME" },
    { key: "amount", hint: "Amount charged, e.g. ₦1,000.00" },
    { key: "recipient", hint: RECIPIENT_HINT[service] },
  ];
  if (status === "failed") list.push({ key: "refund_note", hint: "Says whether the refund is done or on its way" });
  if (service === "electricity" && status === "success") list.push({ key: "token_note", hint: "The token, or a note that it will be sent by SMS" });
  return list;
}

const SAMPLE_ITEM: Record<PurchaseService, string> = {
  airtime: "₦500 MTN VTU airtime",
  data: "2GB MTN SME",
  cable: "DStv Compact",
  electricity: "₦5,000 Ikeja Electric prepaid electricity",
};
const SAMPLE_RECIPIENT: Record<PurchaseService, string> = {
  airtime: "0803 123 4567",
  data: "0803 123 4567",
  cable: "7021 000 441",
  electricity: "4512000987",
};

export function sampleVars(service: PurchaseService): Record<string, string> {
  return {
    name: "Jane",
    item: SAMPLE_ITEM[service],
    amount: "₦500.00",
    recipient: SAMPLE_RECIPIENT[service],
    refund_note: "Your money has been returned to your wallet.",
    token_note: " Token: 1234-5678-9012-3456",
  };
}

export const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] || "there";

export function renderMessage(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
