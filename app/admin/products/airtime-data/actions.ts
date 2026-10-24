"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { AIRTIME_DATA_PATH, SERVICES, slugify, type DataUnit, type PackagePrice, type Service } from "@/lib/admin/airtime-data";
import * as db from "@/lib/db/airtime-data";
import type { DiscountFields, PlanFields } from "@/lib/db/airtime-data";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const BAD_INPUT = fail("That change isn't valid. Refresh the page and try again.");
const NOT_FOUND = fail("That item no longer exists. Refresh the page.");

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const round2 = (value: number) => Math.round(value * 100) / 100;
const validService = (value: string): value is Service => SERVICES.some((service) => service.id === value);

function dbError(error: unknown, fkMessage: string): ActionResult {
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return fail("That already exists. Try a different name.");
  if (code === "23503") return fail(fkMessage);
  if (code === "OVERLAP") return fail("That amount range overlaps another discount for this network and type.");
  if (code === "BAD_AIRTIME_TYPE") return fail("Pick an airtime network type.");
  if (code === "BAD_DATA_TYPE") return fail("Pick a data network type.");
  if (code === "BAD_PROVIDER") return fail("Pick a provider that has an endpoint for this service, or choose any provider.");
  console.error("[airtime-data]", error);
  return fail("Something went wrong saving that. Try again.");
}

async function run(
  fn: () => Promise<boolean>,
  options: { id?: string; fk?: string } = {},
): Promise<ActionResult> {
  try {
    if (!(await fn())) return NOT_FOUND;
    revalidatePath(AIRTIME_DATA_PATH);
    return { ok: true, id: options.id };
  } catch (error) {
    return dbError(error, options.fk ?? "That is still in use, so it can't be changed.");
  }
}

export async function createNetwork(name: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  const label = clean(name);
  const id = slugify(label);
  if (!label || label.length > 40 || !id) {
    return fail("Enter a network name using letters or numbers, up to 40 characters.");
  }
  return run(() => db.createNetwork(id, label), { id });
}

export async function renameNetwork(network: string, name: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  const label = clean(name);
  if (!network || !label || label.length > 40) return fail("Enter a network name up to 40 characters.");
  return run(() => db.renameNetwork(network, label));
}

export async function setNetworkEnabled(network: string, enabled: boolean): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!network || typeof enabled !== "boolean") return BAD_INPUT;
  return run(() => db.setNetworkEnabled(network, enabled));
}

export async function removeNetwork(network: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!network) return BAD_INPUT;
  return run(() => db.deleteNetwork(network));
}

export async function createDataType(label: string, service: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  const name = clean(label);
  const slug = slugify(name);
  if (!validService(service)) return fail("Choose airtime or data.");
  if (!name || name.length > 20 || !slug) {
    return fail("Enter a type name using letters or numbers, up to 20 characters.");
  }
  const id = `${service}-${slug}`;
  return run(() => db.createDataType(id, name, service), { id });
}

export async function renameDataType(type: string, label: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  const name = clean(label);
  if (!type || !name || name.length > 20) return fail("Enter a type name up to 20 characters.");
  return run(() => db.renameDataType(type, name));
}

export async function removeDataType(type: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!type) return BAD_INPUT;
  return run(() => db.deleteDataType(type), {
    fk: "Plans or discounts still use this type. Remove or change those first.",
  });
}

export async function setNetworkTypeEnabled(
  network: string,
  type: string,
  enabled: boolean,
): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!network || !type || typeof enabled !== "boolean") return BAD_INPUT;
  return run(() => db.setNetworkTypeEnabled(network, type, enabled), {
    fk: "That network or type no longer exists. Refresh the page.",
  });
}

function parsePlan(input: unknown): PlanFields | null {
  if (!input || typeof input !== "object") return null;
  const plan = input as Partial<PlanFields>;
  const type = clean(plan.type);
  const validity = clean(plan.validity);
  const providerPlanId = clean(plan.providerPlanId);
  const unit: DataUnit | null = plan.unit === "mb" || plan.unit === "gb" ? plan.unit : null;
  if (!type || !unit || !validity || validity.length > 30 || providerPlanId.length > 100) return null;
  if (plan.providerId !== null && typeof plan.providerId !== "string") return null;
  const providerId = plan.providerId?.trim() || null;
  if (providerId && !providerPlanId) return null;
  const packagePrices = parsePackagePrices(plan.packagePrices);
  if (!packagePrices) return null;
  if (
    typeof plan.volume !== "number" ||
    !Number.isFinite(plan.volume) ||
    plan.volume <= 0 ||
    plan.volume > 100_000 ||
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
    type,
    volume: round2(plan.volume),
    unit,
    validity,
    cost: round2(plan.cost),
    price: round2(plan.price),
    packagePrices,
    providerId,
    providerPlanId,
    active: plan.active,
  };
}

const PLAN_FK = "That network, type or package no longer exists. Refresh the page.";

function parsePackagePrices(input: unknown): PackagePrice[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 50) return null;

  const seen = new Set<string>();
  const result: PackagePrice[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const { packageId, mode, value } = item as Partial<PackagePrice>;
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

export async function createPlan(network: string, input: PlanFields): Promise<ActionResult> {
  await requirePermission("products.manage");
  const plan = parsePlan(input);
  if (!network || !plan) return fail("Check the plan details and try again.");
  return run(() => db.createPlan(network, plan), { fk: PLAN_FK });
}

export async function updatePlan(network: string, planId: string, input: PlanFields): Promise<ActionResult> {
  await requirePermission("products.manage");
  const plan = parsePlan(input);
  if (!network || !planId || !plan) return fail("Check the plan details and try again.");
  return run(() => db.updatePlan(network, planId, plan), { fk: PLAN_FK });
}

export async function setPlanActive(network: string, planId: string, active: boolean): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!network || !planId || typeof active !== "boolean") return BAD_INPUT;
  return run(() => db.setPlanActive(network, planId, active));
}

export async function removePlan(network: string, planId: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!network || !planId) return BAD_INPUT;
  return run(() => db.deletePlan(network, planId));
}

function parseDiscount(input: unknown): DiscountFields | null {
  if (!input || typeof input !== "object") return null;
  const discount = input as Partial<DiscountFields>;
  const type = clean(discount.type);
  if (!type) return null;
  if (discount.providerId !== null && typeof discount.providerId !== "string") return null;
  const providerId = discount.providerId?.trim() || null;
  const providerDiscount = discount.providerDiscount;
  if (
    providerDiscount !== null &&
    (typeof providerDiscount !== "number" ||
      !Number.isFinite(providerDiscount) ||
      providerDiscount < 0 ||
      providerDiscount > 100)
  ) {
    return null;
  }
  if (
    typeof discount.min !== "number" ||
    !Number.isFinite(discount.min) ||
    discount.min < 0 ||
    discount.min > 10_000_000 ||
    typeof discount.max !== "number" ||
    !Number.isFinite(discount.max) ||
    discount.max < discount.min ||
    discount.max > 10_000_000 ||
    typeof discount.discount !== "number" ||
    !Number.isFinite(discount.discount) ||
    discount.discount < 0 ||
    discount.discount > 100 ||
    typeof discount.active !== "boolean"
  ) {
    return null;
  }
  return {
    type,
    min: round2(discount.min),
    max: round2(discount.max),
    discount: round2(discount.discount),
    providerId,
    providerDiscount: providerDiscount === null ? null : round2(providerDiscount),
    active: discount.active,
  };
}

const DISCOUNT_BAD = fail("Check the discount details and try again.");
const DISCOUNT_FK = "That network, type, or provider no longer exists. Refresh the page.";

export async function createDiscount(network: string, input: DiscountFields): Promise<ActionResult> {
  await requirePermission("products.manage");
  const discount = parseDiscount(input);
  if (!network || !discount) return DISCOUNT_BAD;
  return run(() => db.createDiscount(network, discount), { fk: DISCOUNT_FK });
}

export async function updateDiscount(network: string, id: string, input: DiscountFields): Promise<ActionResult> {
  await requirePermission("products.manage");
  const discount = parseDiscount(input);
  if (!network || !id || !discount) return DISCOUNT_BAD;
  return run(() => db.updateDiscount(network, id, discount), { fk: DISCOUNT_FK });
}

export async function setDiscountActive(network: string, id: string, active: boolean): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!network || !id || typeof active !== "boolean") return BAD_INPUT;
  return run(() => db.setDiscountActive(network, id, active));
}

export async function removeDiscount(network: string, id: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!network || !id) return BAD_INPUT;
  return run(() => db.deleteDiscount(network, id));
}
