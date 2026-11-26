import type { Metadata } from "next";
import { connection } from "next/server";
import { TemplateManager } from "@/components/admin/announcements/template-manager";
import { requirePermission } from "@/lib/admin/auth";
import { listPurchaseTemplates } from "@/lib/db/purchase-templates";

export const metadata: Metadata = { title: "Message templates | Spur VTU" };

export default async function TemplatesPage() {
  await connection();
  await requirePermission("announcements.manage");
  const templates = await listPurchaseTemplates();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Message templates</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          What customers read after an airtime, data, cable TV or electricity purchase succeeds, is pending or fails.
          One template per service and status can be live at a time.
        </p>
      </header>
      <TemplateManager templates={templates} />
    </div>
  );
}
