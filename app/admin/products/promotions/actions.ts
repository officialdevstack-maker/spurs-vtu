"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { CODE_PATTERN, PROMOTIONS_PATH, isPromoService, normalizeCode, type PromoFields } from "@/lib/admin/promotions";
import { recordAudit } from "@/lib/db/audit";
import * as db from "@/lib/db/promotions";

export type PromoActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): PromoActionResult => ({ ok: false, error });
const BAD_INPUT = fail("That change isn't valid. Refresh the page and try again.");
const NOT_FOUND = fail("That code no longer exists. Refresh the page.");
const round2 = (v: number) => Math.round(v * 100) / 100;
const positive = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max;

function parseDate(v: unknown): string | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function parsePromo(input: unknown): PromoFields | string {
  if (!input || typeof input !== "object") return "Check the code details and try again.";
  const raw = input as Record<string, unknown>;
  const code = normalizeCode(typeof raw.code === "string" ? raw.code : "");
  if (!CODE_PATTERN.test(code)) return "Use 4 to 20 letters or numbers for the code.";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (description.length > 160) return "The description can be up to 160 characters.";
  if (raw.kind !== "percent" && raw.kind !== "fixed") return "Choose percent or fixed.";
  if (!positive(raw.value, raw.kind === "percent" ? 100 : 100_000)) {
    return raw.kind === "percent" ? "The percentage must be above 0 and up to 100." : "Enter a discount from ₦0.01 to ₦100,000.";
  }
  const maxDiscount = raw.maxDiscount ?? null;
  if (maxDiscount !== null && !positive(maxDiscount, 100_000)) return "The discount cap must be above 0.";
  const minSpend = raw.minSpend ?? 0;
  if (typeof minSpend !== "number" || !Number.isFinite(minSpend) || minSpend < 0 || minSpend > 10_000_000) {
    return "Enter a minimum spend of 0 or more.";
  }
  const services = Array.isArray(raw.services) ? [...new Set(raw.services.filter(isPromoService))] : null;
  if (!services) return "Check the services and try again.";
  const totalLimit = raw.totalLimit ?? null;
  if (totalLimit !== null && !(Number.isInteger(totalLimit) && positive(totalLimit, 1_000_000))) {
    return "The total limit must be a whole number above 0, or empty for no limit.";
  }
  const perCustomerLimit = raw.perCustomerLimit;
  if (!(Number.isInteger(perCustomerLimit) && positive(perCustomerLimit, 1000))) {
    return "Uses per customer must be a whole number from 1 to 1,000.";
  }
  const startsAt = parseDate(raw.startsAt);
  const expiresAt = parseDate(raw.expiresAt);
  if (startsAt === undefined || expiresAt === undefined) return "Check the dates and try again.";
  if (startsAt && expiresAt && expiresAt <= startsAt) return "The end date must be after the start date.";
  if (typeof raw.active !== "boolean") return "Check the code details and try again.";
  return {
    code, description, kind: raw.kind, value: round2(raw.value),
    maxDiscount: maxDiscount === null ? null : round2(maxDiscount as number),
    minSpend: round2(minSpend), services,
    totalLimit: totalLimit as number | null, perCustomerLimit: perCustomerLimit as number,
    startsAt, expiresAt, active: raw.active,
  };
}

async function run(fn: () => Promise<boolean>, log: () => Promise<void>): Promise<PromoActionResult> {
  try {
    if (!(await fn())) return NOT_FOUND;
    await log();
    revalidatePath(PROMOTIONS_PATH);
    return { ok: true };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") return fail("A promo code with that name already exists.");
    if (code === "23503") return fail("This code has been used, so it can't be deleted. Turn it off instead.");
    console.error("[promotions]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}

export async function createPromo(input: unknown): Promise<PromoActionResult> {
  const admin = await requirePermission("products.manage");
  const promo = parsePromo(input);
  if (typeof promo === "string") return fail(promo);
  const id = randomUUID();
  return run(() => db.createPromo(id, promo), () =>
    recordAudit(admin, { action: "promo.create", target: id, summary: `Created promo code ${promo.code}`, meta: { ...promo } }));
}

export async function updatePromo(id: string, input: unknown): Promise<PromoActionResult> {
  const admin = await requirePermission("products.manage");
  if (typeof id !== "string" || !id) return BAD_INPUT;
  const promo = parsePromo(input);
  if (typeof promo === "string") return fail(promo);
  return run(() => db.updatePromo(id, promo), () =>
    recordAudit(admin, { action: "promo.update", target: id, summary: `Updated promo code ${promo.code}`, meta: { ...promo } }));
}

export async function setPromoActive(id: string, active: boolean): Promise<PromoActionResult> {
  const admin = await requirePermission("products.manage");
  if (typeof id !== "string" || !id || typeof active !== "boolean") return BAD_INPUT;
  return run(() => db.setPromoActive(id, active), () =>
    recordAudit(admin, { action: "promo.toggle", target: id, summary: `${active ? "Turned on" : "Turned off"} a promo code`, meta: { active } }));
}

export async function removePromo(id: string): Promise<PromoActionResult> {
  const admin = await requirePermission("products.manage");
  if (typeof id !== "string" || !id) return BAD_INPUT;
  return run(() => db.deletePromo(id), () =>
    recordAudit(admin, { action: "promo.delete", target: id, summary: "Deleted a promo code" }));
}
