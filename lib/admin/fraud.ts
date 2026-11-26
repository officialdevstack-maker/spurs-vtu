export type FraudRuleId = "velocity" | "repeated_failures" | "shared_phone" | "abnormal_amount";
export type FraudAction = "flag" | "hold" | "block";
export type FraudRule = { rule: FraudRuleId; enabled: boolean; action: FraudAction; params: Record<string, number> };

export const FRAUD_PATH = "/admin/users/fraud";

export const FRAUD_ACTIONS: { id: FraudAction; label: string; hint: string }[] = [
  { id: "flag", label: "Flag", hint: "Purchase goes through. Staff see it in the review queue." },
  { id: "hold", label: "Hold", hint: "Refuse the purchase and stop the customer buying until staff review it." },
  { id: "block", label: "Block", hint: "Refuse this purchase only." },
];

type Field = { key: string; label: string; min: number; max: number };
export const RULE_META: Record<FraudRuleId, { label: string; hint: string; fields: Field[] }> = {
  velocity: {
    label: "Purchase velocity",
    hint: "Too many purchases in a short time.",
    fields: [
      { key: "max", label: "Max purchases", min: 1, max: 1000 },
      { key: "minutes", label: "Within minutes", min: 1, max: 1440 },
    ],
  },
  repeated_failures: {
    label: "Repeated failures",
    hint: "Many failed purchases in a row. Provider outages can cause these, so flagging is safer than holding.",
    fields: [
      { key: "max", label: "Max failures", min: 1, max: 100 },
      { key: "minutes", label: "Within minutes", min: 1, max: 1440 },
    ],
  },
  shared_phone: {
    label: "Shared phone number",
    hint: "More accounts than this use the same phone number.",
    fields: [{ key: "max", label: "Max accounts per number", min: 1, max: 100 }],
  },
  abnormal_amount: {
    label: "Abnormal amount",
    hint: "A price above the cap, or far above this customer's own average (needs 5 past purchases).",
    fields: [
      { key: "maxAmount", label: "Cap per purchase (₦)", min: 1, max: 100_000_000 },
      { key: "avgMultiple", label: "Times their average", min: 1, max: 1000 },
    ],
  },
};

export const isRuleId = (v: unknown): v is FraudRuleId => typeof v === "string" && v in RULE_META;
export const isFraudAction = (v: unknown): v is FraudAction => FRAUD_ACTIONS.some((a) => a.id === v);

export function parseParams(rule: FraudRuleId, raw: unknown): Record<string, number> | string {
  if (!raw || typeof raw !== "object") return "Check the thresholds and try again.";
  const out: Record<string, number> = {};
  for (const field of RULE_META[rule].fields) {
    const value = (raw as Record<string, unknown>)[field.key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < field.min || value > field.max) {
      return `${field.label} must be from ${field.min} to ${field.max}.`;
    }
    out[field.key] = Math.round(value * 100) / 100;
  }
  return out;
}

export type FlagItem = {
  id: string;
  customerId: string;
  customer: string;
  rule: FraudRuleId;
  action: FraudAction;
  detail: Record<string, unknown>;
  at: string;
};
