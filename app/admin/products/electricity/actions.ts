"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { slugify } from "@/lib/admin/airtime-data";
import { ELECTRICITY_PATH } from "@/lib/admin/electricity";
import { ELECTRICITY_PATH as USER_ELECTRICITY_PATH } from "@/lib/electricity-purchase";
import * as db from "@/lib/db/electricity";
import type { DiscoFields } from "@/lib/db/electricity";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const BAD_INPUT = fail("That change isn't valid. Refresh the page and try again.");
const NOT_FOUND = fail("That item no longer exists. Refresh the page.");

const clean = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");
const round2 = (value: number) => Math.round(value * 100) / 100;
const percent = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
const naira = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10_000_000;

function dbError(error: unknown): ActionResult {
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return fail("A disco with that name already exists.");
  if (code === "23503") return fail("That provider no longer exists. Refresh the page.");
  if (code === "BAD_PROVIDER") return fail("Pick a provider that has an electricity endpoint, or choose any provider.");
  console.error("[electricity]", error);
  return fail("Something went wrong saving that. Try again.");
}

async function run(fn: () => Promise<boolean>, id?: string): Promise<ActionResult> {
  try {
    if (!(await fn())) return NOT_FOUND;
    revalidatePath(ELECTRICITY_PATH);
    revalidatePath(USER_ELECTRICITY_PATH);
    return { ok: true, id };
  } catch (error) {
    return dbError(error);
  }
}

function parseDisco(input: unknown): DiscoFields | string {
  if (!input || typeof input !== "object") return "Check the disco details and try again.";
  const raw = input as Partial<DiscoFields>;
  const name = clean(raw.name);
  if (!name || name.length > 40 || !slugify(name)) return "Enter a name using letters or numbers, up to 40 characters.";

  const providerCode = clean(raw.providerCode);
  if (!/^[A-Za-z0-9_-]{0,40}$/.test(providerCode)) {
    return "The provider code can use letters, numbers, - or _, up to 40 characters.";
  }
  if (raw.providerId !== null && typeof raw.providerId !== "string") return "Check the disco details and try again.";
  const providerId = raw.providerId?.trim() || null;
  if (providerId && !providerCode) return "Enter the provider's code for this disco.";

  if (!percent(raw.discount)) return "The discount must be from 0 to 100.";
  const providerDiscount = raw.providerDiscount ?? null;
  if (providerDiscount !== null && !percent(providerDiscount)) return "The provider discount must be from 0 to 100.";
  if (!naira(raw.minAmount) || !naira(raw.maxAmount) || raw.maxAmount < raw.minAmount) {
    return "Enter a minimum amount, and a maximum that is not lower.";
  }
  if (typeof raw.enabled !== "boolean") return "Check the disco details and try again.";

  return {
    name,
    providerCode,
    discount: round2(raw.discount),
    providerId,
    providerDiscount: providerDiscount === null ? null : round2(providerDiscount),
    minAmount: round2(raw.minAmount),
    maxAmount: round2(raw.maxAmount),
    enabled: raw.enabled,
  };
}

export async function createDisco(input: DiscoFields): Promise<ActionResult> {
  await requirePermission("products.manage");
  const disco = parseDisco(input);
  if (typeof disco === "string") return fail(disco);
  return run(() => db.createDisco(slugify(disco.name), disco), slugify(disco.name));
}

export async function updateDisco(id: string, input: DiscoFields): Promise<ActionResult> {
  await requirePermission("products.manage");
  const disco = parseDisco(input);
  if (!id) return BAD_INPUT;
  if (typeof disco === "string") return fail(disco);
  return run(() => db.updateDisco(id, disco));
}

export async function setDiscoEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!id || typeof enabled !== "boolean") return BAD_INPUT;
  return run(() => db.setDiscoEnabled(id, enabled));
}

export async function removeDisco(id: string): Promise<ActionResult> {
  await requirePermission("products.manage");
  if (!id) return BAD_INPUT;
  return run(() => db.deleteDisco(id));
}
