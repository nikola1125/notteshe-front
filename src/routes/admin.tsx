import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAdminUserFn, logoutAdminFn } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import type { AdminUser } from "@/db/schema";
import { Toaster } from "sonner";

// Client-side cache — avoids a server round-trip on every sidebar navigation.
// Cleared on logout; refreshed at most once per 5 minutes.
let _adminCache: { admin: AdminUser; exp: number } | null = null;

async function getCachedAdmin(): Promise<AdminUser | null> {
  if (_adminCache && _adminCache.exp > Date.now()) return _adminCache.admin;
  const admin = await getAdminUserFn();
  if (admin) _adminCache = { admin, exp: Date.now() + 5 * 60 * 1000 };
  else _adminCache = null;
  return admin;
}

export function clearAdminCache() {
  _adminCache = null;
}

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const admin = await getCachedAdmin();
    if (!admin) {
      throw redirect({ to: "/admin-login" });
    }
    return { admin };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { admin } = Route.useRouteContext() as { admin: AdminUser };

  return (
    <div className="flex h-[100dvh] bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="flex h-full w-full flex-col lg:flex-row">
        <AdminSidebar adminName={admin.name} adminRole={admin.role} />
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
