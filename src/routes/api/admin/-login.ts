import { createAPIFileRoute } from "@tanstack/react-start/api";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUser } from "@/db/schema";
import { verifyPassword, createAdminSession } from "@/lib/admin/auth";

export const APIRoute = createAPIFileRoute("/api/admin/login")({
  POST: async ({ request }) => {
    try {
      const body = await request.json() as { email?: string; password?: string };
      const { email, password } = body;

      if (!email || !password) {
        return new Response(
          JSON.stringify({ success: false, error: "Email and password required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const rows = await db()
        .select()
        .from(adminUser)
        .where(eq(adminUser.email, email.toLowerCase().trim()))
        .limit(1);

      const admin = rows[0];

      if (!admin || !admin.isActive) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid credentials" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const valid = await verifyPassword(password, admin.passwordHash);
      if (!valid) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid credentials" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        request.headers.get("x-real-ip") ??
        undefined;

      const token = await createAdminSession(admin.id, ip);

      const cookieValue = [
        `admin_token=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${7 * 24 * 60 * 60}`,
        ...(process.env["NODE_ENV"] === "production" ? ["Secure"] : []),
      ].join("; ");

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookieValue,
          },
        }
      );
    } catch (err) {
      console.error("admin login error", err);
      return new Response(
        JSON.stringify({ success: false, error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
});
