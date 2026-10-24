import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminAccess } from "@/lib/admin/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]" role="status" aria-live="polite">
          Loading admin workspace...
        </div>
      }
    >
      <AuthenticatedAdminShell>{children}</AuthenticatedAdminShell>
    </Suspense>
  );
}

async function AuthenticatedAdminShell({ children }: { children: ReactNode }) {
  const { user, permissions } = await getAdminAccess();
  const username = "username" in user && typeof user.username === "string" ? user.username : undefined;

  return (
    <AdminShell
      user={{
        name: user.name ?? "Admin",
        username,
        email: user.email,
        picture: user.picture,
      }}
      permissions={[...permissions]}
    >
      {children}
    </AdminShell>
  );
}
