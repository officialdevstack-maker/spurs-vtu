import type { Permission } from "@/lib/admin/permissions";

export type Role = {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  members: number;
};

export type StaffMember = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  roleId: string;
  roleName: string;
};

export const ROLES_PATH = "/admin/users/roles";
export const rolesUrl = (tab?: "roles" | "staff") =>
  tab === "staff" ? `${ROLES_PATH}?tab=staff` : ROLES_PATH;
export const newRoleUrl = `${ROLES_PATH}/new`;
export const editRoleUrl = (id: string) => `${ROLES_PATH}/${encodeURIComponent(id)}`;
