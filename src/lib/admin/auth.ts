import { createServerFn } from "@tanstack/react-start";
import type { AdminUser } from "@/db/schema";

// Server functions — safe to import in client components (handlers stripped from client bundle)

export const loginAdminFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { email: string; password: string })
  .handler(async ({ data }) => {
    const { loginAdmin } = await import("./auth.server");
    return loginAdmin(data.email, data.password);
  });

export const logoutAdminFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const { logoutAdmin } = await import("./auth.server");
    await logoutAdmin();
  }
);

export const getAdminUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminUser | null> => {
    const { getAdminSession } = await import("./auth.server");
    return getAdminSession();
  }
);

// Plain async utility — called from within createServerFn handlers only.
// Safe to import client-side: the function body (and its dynamic import) never executes there.
export async function requireAdmin(): Promise<AdminUser> {
  const { getAdminSession } = await import("./auth.server");
  const admin = await getAdminSession();
  if (!admin) throw new Error("ADMIN_UNAUTHORIZED");
  return admin;
}
