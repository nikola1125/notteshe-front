import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAdminUserFn } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import type { AdminUser } from "@/db/schema";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const admin = await getAdminUserFn();
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
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="flex h-full flex-col lg:flex-row w-full">
        <AdminSidebar adminName={admin.name} adminRole={admin.role} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
