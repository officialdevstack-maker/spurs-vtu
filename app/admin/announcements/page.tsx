import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { WELCOME_PATH } from "@/lib/admin/announcements";

export default async function AnnouncementsIndexPage() {
  await connection();
  await requirePermission("announcements.manage");
  redirect(WELCOME_PATH);
}
