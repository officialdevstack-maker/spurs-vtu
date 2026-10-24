import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireSpursUser } from "@spurs-cloud/accounts/next";
import { PERMISSIONS, type Permission } from "@/lib/admin/permissions";
import { getStaffPermissions } from "@/lib/db/roles";

function ownerIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_SPURS_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export const getAdminAccess = cache(async () => {
  const user = await requireSpursUser();
  if (ownerIds().has(user.sub)) {
    return { user, owner: true, permissions: new Set<Permission>(PERMISSIONS) };
  }

  const granted = await getStaffPermissions(user.sub);
  if (!granted) notFound();
  return { user, owner: false, permissions: new Set<Permission>(granted) };
});

export async function requireAdmin() {
  return (await getAdminAccess()).user;
}

export async function requirePermission(permission: Permission) {
  const access = await getAdminAccess();
  if (!access.permissions.has(permission)) notFound();
  return access.user;
}
