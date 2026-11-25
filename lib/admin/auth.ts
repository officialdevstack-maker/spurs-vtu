import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireSpursUser } from "@/lib/spurs";
import { PERMISSIONS, type Permission } from "@/lib/admin/permissions";
import { getStaffAccess } from "@/lib/db/roles";

export const getAdminAccess = cache(async () => {
  const user = await requireSpursUser();
  const access = await getStaffAccess(user.sub);
  if (!access) notFound();
  const permissions = new Set<Permission>(access.owner ? PERMISSIONS : access.permissions);
  return { user, owner: access.owner, permissions };
});

export async function requireAdmin() {
  return (await getAdminAccess()).user;
}

export async function requirePermission(permission: Permission) {
  const access = await getAdminAccess();
  if (!access.permissions.has(permission)) notFound();
  return access.user;
}
