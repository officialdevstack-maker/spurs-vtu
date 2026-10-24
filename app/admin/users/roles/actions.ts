"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { slugify } from "@/lib/admin/airtime-data";
import { isPermission } from "@/lib/admin/permissions";
import { ROLES_PATH } from "@/lib/admin/roles";
import * as db from "@/lib/db/roles";
import type { RoleFields } from "@/lib/db/roles";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const BAD_INPUT = fail("That change isn't valid. Refresh the page and try again.");
const NOT_FOUND = fail("That item no longer exists. Refresh the page.");

const clean = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

function databaseCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function dbError(error: unknown, fkMessage: string): ActionResult {
  const code = databaseCode(error);
  if (code === "23505") return fail("A role with that name already exists.");
  if (code === "23503") return fail(fkMessage);
  if (code === "NO_CUSTOMER") {
    return fail("No customer found with that username, email, phone or Spurs ID. They need to log in to Spur VTU once first.");
  }
  if (code === "ALREADY_STAFF") return fail("That person is already on the staff list.");
  if (code === "OWNER") return fail("Owners already have full access and can't be added as staff.");
  console.error("[roles]", error);
  return fail("Something went wrong saving that. Try again.");
}

async function run(
  fn: () => Promise<boolean>,
  options: { id?: string; fk?: string } = {},
): Promise<ActionResult> {
  try {
    if (!(await fn())) return NOT_FOUND;
    revalidatePath(ROLES_PATH);
    revalidatePath("/admin");
    return { ok: true, id: options.id };
  } catch (error) {
    return dbError(error, options.fk ?? "That role no longer exists. Refresh the page.");
  }
}

function parseRole(input: unknown): RoleFields | string {
  if (!input || typeof input !== "object") return "Check the role details and try again.";
  const raw = input as { name?: unknown; description?: unknown; permissions?: unknown };
  const name = clean(raw.name);
  if (!name || name.length > 40 || !slugify(name)) {
    return "Enter a role name using letters or numbers, up to 40 characters.";
  }
  const description = clean(raw.description);
  if (description.length > 160) return "The description can be up to 160 characters.";
  const permissions = Array.isArray(raw.permissions) ? [...new Set(raw.permissions.filter(isPermission))] : [];
  if (permissions.length === 0) return "Choose at least one permission.";
  return { name, description, permissions };
}

export async function createRole(input: RoleFields): Promise<ActionResult> {
  await requirePermission("roles.manage");
  const role = parseRole(input);
  if (typeof role === "string") return fail(role);
  const id = slugify(role.name);
  return run(() => db.createRole(id, role), { id });
}

export async function updateRole(id: string, input: RoleFields): Promise<ActionResult> {
  await requirePermission("roles.manage");
  const role = parseRole(input);
  if (typeof id !== "string" || !id || typeof role === "string") {
    return typeof role === "string" ? fail(role) : BAD_INPUT;
  }
  return run(() => db.updateRole(id, role));
}

export async function removeRole(id: string): Promise<ActionResult> {
  await requirePermission("roles.manage");
  if (typeof id !== "string" || !id) return BAD_INPUT;
  return run(() => db.deleteRole(id), {
    fk: "Staff still have this role. Move them to another role first.",
  });
}

export async function addStaff(identifier: string, roleId: string): Promise<ActionResult> {
  await requirePermission("roles.manage");
  const who = clean(identifier);
  if (who.length < 2 || who.length > 100 || typeof roleId !== "string" || !roleId) {
    return fail("Enter a username, email, phone number or Spurs ID.");
  }
  return run(() => db.addStaff(who, roleId), { fk: "That role no longer exists. Refresh the page." });
}

export async function changeStaffRole(id: string, roleId: string): Promise<ActionResult> {
  await requirePermission("roles.manage");
  if (typeof id !== "string" || !id || typeof roleId !== "string" || !roleId) return BAD_INPUT;
  return run(() => db.setStaffRole(id, roleId), { fk: "That role no longer exists. Refresh the page." });
}

export async function removeStaff(id: string): Promise<ActionResult> {
  await requirePermission("roles.manage");
  if (typeof id !== "string" || !id) return BAD_INPUT;
  return run(() => db.deleteStaff(id));
}
