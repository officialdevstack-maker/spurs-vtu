import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAdminAccess } from "@/lib/admin/auth";

export default async function UsersIndexPage() {
  await connection();
  const { permissions } = await getAdminAccess();
  redirect(permissions.has("customers.view") ? "/admin/users/list" : "/admin/users/roles");
}
