import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminShellSkeleton } from "@/components/ui/skeletons";
import { getAdminAccess } from "@/lib/admin/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
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
