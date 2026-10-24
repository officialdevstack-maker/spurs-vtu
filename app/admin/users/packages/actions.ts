"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { slugify } from "@/lib/admin/airtime-data";
import { PACKAGES_PATH } from "@/lib/admin/packages";
import * as db from "@/lib/db/packages";
import type { PackageFields } from "@/lib/db/packages";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const BAD_INPUT = fail("That change isn't valid. Refresh the page and try again.");
const NOT_FOUND = fail("That package no longer exists, or it is the default. Refresh the page.");

const clean = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");
const round2 = (value: number) => Math.round(value * 100) / 100;

function databaseCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

async function run(fn: () => Promise<boolean>, options: { id?: string; fk?: string } = {}): Promise<ActionResult> {
  try {
    if (!(await fn())) return NOT_FOUND;
    revalidatePath(PACKAGES_PATH);
    return { ok: true, id: options.id };
  } catch (error) {
    const code = databaseCode(error);
    if (code === "23505") return fail("A package with that name already exists.");
    if (code === "23503") return fail(options.fk ?? "That package no longer exists. Refresh the page.");
    console.error("[packages]", error);
    return fail("Something went wrong saving that. Try again.");
  }
}

function parsePackage(input: unknown): PackageFields | string {
  if (!input || typeof input !== "object") return "Check the package details and try again.";
  const raw = input as Partial<PackageFields>;

  const name = clean(raw.name);
  if (!name || name.length > 30 || !slugify(name)) return "Enter a name using letters or numbers, up to 30 characters.";
  const description = clean(raw.description);
  if (description.length > 160) return "The description can be up to 160 characters.";

  const sortOrder = Number(raw.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 999) {
    return "Order must be a whole number from 1 to 999.";
  }
  const fee = Number(raw.upgradeFee);
  if (!Number.isFinite(fee) || fee < 0 || fee > 10_000_000) return "Enter an upgrade fee, 0 or more.";
  if (typeof raw.isDefault !== "boolean") return "Check the package details and try again.";

  return { name, description, sortOrder, upgradeFee: round2(fee), isDefault: raw.isDefault };
}

export async function createPackage(input: PackageFields): Promise<ActionResult> {
  await requirePermission("packages.manage");
  const pkg = parsePackage(input);
  if (typeof pkg === "string") return fail(pkg);
  const id = slugify(pkg.name);
  return run(() => db.createPackage(id, pkg), { id });
}

export async function updatePackage(id: string, input: PackageFields): Promise<ActionResult> {
  await requirePermission("packages.manage");
  if (!id) return BAD_INPUT;
  const pkg = parsePackage(input);
  if (typeof pkg === "string") return fail(pkg);
  return run(() => db.updatePackage(id, pkg));
}

export async function removePackage(id: string): Promise<ActionResult> {
  await requirePermission("packages.manage");
  if (!id) return BAD_INPUT;
  return run(() => db.deletePackage(id), {
    fk: "Customers are still on this package. Move them to another package first.",
  });
}
