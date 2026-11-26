import "server-only";
import { RULE_META, type FraudAction, type FraudRule } from "@/lib/admin/fraud";
import { listAlertRecipients } from "@/lib/db/balances";
import {
  countRecentDebits, countRecentFailures, countSharedPhone, getRules, getSpendProfile,
  hasOpenHold, isExempt, openFlag,
} from "@/lib/db/fraud";
import { insertNotificationOnce } from "@/lib/db/notify";

export type Verdict = { allow: true } | { allow: false; message: string };

const HELD = "Your account is being reviewed for unusual activity. Please contact support.";
const BLOCKED = "We couldn't process this purchase. Please contact support.";
const RANK: Record<FraudAction, number> = { flag: 1, block: 2, hold: 3 };

type Fired = { rule: FraudRule; detail: Record<string, unknown> };

async function evaluate(rule: FraudRule, customerId: string, price: number): Promise<Fired | null> {
  const p = rule.params;
  switch (rule.rule) {
    case "velocity": {
      const count = await countRecentDebits(customerId, p.minutes);
      return count >= p.max ? { rule, detail: { count, limit: p.max, minutes: p.minutes } } : null;
    }
    case "repeated_failures": {
      const count = await countRecentFailures(customerId, p.minutes);
      return count >= p.max ? { rule, detail: { count, limit: p.max, minutes: p.minutes } } : null;
    }
    case "shared_phone": {
      const accounts = await countSharedPhone(customerId);
      return accounts > p.max ? { rule, detail: { accounts, limit: p.max } } : null;
    }
    case "abnormal_amount": {
      if (price > p.maxAmount) return { rule, detail: { price, cap: p.maxAmount } };
      const profile = await getSpendProfile(customerId);
      if (profile.count >= 5 && price > profile.average * p.avgMultiple) {
        return { rule, detail: { price, average: Math.round(profile.average * 100) / 100, multiple: p.avgMultiple } };
      }
      return null;
    }
  }
}

async function tellStaff(flagId: string, rule: FraudRule, customerId: string) {
  const recipients = await listAlertRecipients();
  const verb = rule.action === "hold" ? "held" : "blocked";
  await Promise.allSettled(
    recipients.map((person) =>
      insertNotificationOnce({
        id: `fraud-${flagId}-${person.id}`,
        customerId: person.id,
        title: `Purchase ${verb} for review`,
        body: `The "${RULE_META[rule.rule].label}" rule ${verb} a purchase (customer ${customerId}). Review it under User management → Fraud review.`,
      }),
    ),
  );
}

export async function screenPurchase(input: { customerId: string; price: number; reference: string }): Promise<Verdict> {
  const { customerId, price, reference } = input;
  try {
    if (await isExempt(customerId)) return { allow: true };
    if (await hasOpenHold(customerId)) return { allow: false, message: HELD };

    const rules = (await getRules()).filter((rule) => rule.enabled);
    const results = await Promise.all(rules.map((rule) => evaluate(rule, customerId, price)));
    const fired = results.filter((item): item is Fired => item !== null);
    if (fired.length === 0) return { allow: true };

    let strongest: FraudAction = "flag";
    for (const item of fired) {
      if (RANK[item.rule.action] > RANK[strongest]) strongest = item.rule.action;
      const flagId = await openFlag({
        customerId, rule: item.rule.rule, action: item.rule.action, reference,
        detail: { ...item.detail, price },
      });
      if (flagId && item.rule.action !== "flag") await tellStaff(flagId, item.rule, customerId);
    }
    if (strongest === "hold") return { allow: false, message: HELD };
    if (strongest === "block") return { allow: false, message: BLOCKED };
    return { allow: true };
  } catch (error) {
    console.error("[fraud] Screening failed, allowing the purchase", reference, error);
    return { allow: true };
  }
}
