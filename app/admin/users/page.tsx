import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAdminAccess } from "@/lib/admin/auth";

export default async function UsersIndexPage() {
  await connection();
  const { permissions } = await getAdminAccess();
  if (permissions.has("customers.view")) redirect("/admin/users/list");
  if (permissions.has("roles.manage")) redirect("/admin/users/roles");
  redirect("/admin");
}
