"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { CABLE_PATH } from "@/lib/admin/cable";
import * as db from "@/lib/db/cable";
import type { CablePlanFields } from "@/lib/db/cable";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const BAD_INPUT = fail("That change isn't valid. Refresh the page and try again.");
const NOT_FOUND = fail("That item no longer exists. Refresh the page.");

const clean = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");
const round2 = (value: number) => Math.round(value * 100) / 100;

function dbError(error: unknown, fkMessage: string): ActionResult {
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return fail("That already exists. Try a different name.");
  if (code === "23503") return fail(fkMessage);
  if (code === "BAD_PROVIDER") return fail("Pick a provider that has a cable endpoint, or choose any provider.");
  console.error("[cable-tv]", error);
  return fail("Something went wrong saving that. Try again.");
}

async function run(fn: () => Promise<boolean>, options: { id?: string; fk?: string } = {}): Promise<ActionResult> {
  try {
    if (!(await fn())) return NOT_FOUND;
    revalidatePath(CABLE_PATH);
    return { ok: true, id: options.id };
  } catch (error) {
    return dbError(error, options.fk ?? "That is still in use, so it can't be changed.");
  }
}

export async function createOperator(name: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  const label = clean(name);
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!label || label.length > 40 || !id) {
    return fail("Enter an operator name using letters or numbers, up to 40 characters.");
  }
  return run(() => db.createOperator(id, label), { id });
}

export async function renameOperator(operator: string, name: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  const label = clean(name);
  if (!operator || !label || label.length > 40) return fail("Enter an operator name up to 40 characters.");
  return run(() => db.renameOperator(operator, label));
}

export async function setOperatorEnabled(operator: string, enabled: boolean): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!operator || typeof enabled !== "boolean") return BAD_INPUT;
  return run(() => db.setOperatorEnabled(operator, enabled));
}

export async function removeOperator(operator: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!operator) return BAD_INPUT;
  return run(() => db.deleteOperator(operator));
}

function parsePackagePrices(input: unknown) {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 50) return null;

  const seen = new Set<string>();
  const result: { packageId: string; mode: "fixed" | "percent"; value: number }[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const { packageId, mode, value } = item as { packageId?: string; mode?: string; value?: number };
    if (typeof packageId !== "string" || !packageId || seen.has(packageId)) return null;
    if (mode !== "fixed" && mode !== "percent") return null;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > (mode === "percent" ? 100 : 10_000_000)
    ) {
      return null;
    }
    seen.add(packageId);
    result.push({ packageId, mode, value: round2(value) });
  }
  return result;
}

function parsePlan(input: unknown): CablePlanFields | null {
  if (!input || typeof input !== "object") return null;
  const plan = input as Partial<CablePlanFields>;
  const name = clean(plan.name);
  const validity = clean(plan.validity);
  const providerPlanId = clean(plan.providerPlanId);
  if (!name || name.length > 100) return null;
  if (!validity || validity.length > 30) return null;
  if (plan.providerId !== null && typeof plan.providerId !== "string") return null;
  const providerId = plan.providerId?.trim() || null;
  if (providerId && !providerPlanId) return null;
  if (providerPlanId.length > 100) return null;
  const packagePrices = parsePackagePrices(plan.packagePrices);
  if (!packagePrices) return null;
  if (
    typeof plan.cost !== "number" ||
    !Number.isFinite(plan.cost) ||
    plan.cost < 0 ||
    plan.cost > 10_000_000 ||
    typeof plan.price !== "number" ||
    !Number.isFinite(plan.price) ||
    plan.price < 0 ||
    plan.price > 10_000_000 ||
    typeof plan.active !== "boolean"
  ) {
    return null;
  }

  return {
    name,
    validity,
    cost: round2(plan.cost),
    price: round2(plan.price),
    packagePrices,
    providerId,
    providerPlanId,
    active: plan.active,
  };
}

const PLAN_FK = "That operator, package or provider no longer exists. Refresh the page.";

export async function createPlan(operator: string, input: CablePlanFields): Promise<ActionResult> {
  await requirePermission("products.manage");
  const plan = parsePlan(input);
  if (!operator || !plan) return fail("Check the bouquet details and try again.");
  return run(() => db.createCablePlan(operator, plan), { fk: PLAN_FK });
}

export async function updatePlan(operator: string, planId: string, input: CablePlanFields): Promise<ActionResult> {
  await requirePermission("products.manage");
  const plan = parsePlan(input);
  if (!operator || !planId || !plan) return fail("Check the bouquet details and try again.");
  return run(() => db.updateCablePlan(operator, planId, plan), { fk: PLAN_FK });
}

export async function setPlanActive(operator: string, planId: string, active: boolean): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!operator || !planId || typeof active !== "boolean") return BAD_INPUT;
  return run(() => db.setCablePlanActive(operator, planId, active));
}

export async function removePlan(operator: string, planId: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!operator || !planId) return BAD_INPUT;
  return run(() => db.deleteCablePlan(operator, planId));
}
