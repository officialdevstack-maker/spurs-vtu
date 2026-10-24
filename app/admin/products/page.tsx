import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";

export default async function ProductsIndexPage() {
  await connection();
  await requirePermission("products.view");
  redirect("/admin/products/airtime-data");
}
