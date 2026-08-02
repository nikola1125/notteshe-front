import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/start-server-core/request-response";
import { getAdminSession } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import type { AdminUser } from "@/db/schema";

const getAdminUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminUser | null> => {
    const request = getRequest();
    return await getAdminSession(request);
  }
);

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const admin = await getAdminUser();
    if (!admin) {
      throw redirect({ to: "/admin/login" });
    }
    return { admin };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { admin } = Route.useRouteContext();

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
