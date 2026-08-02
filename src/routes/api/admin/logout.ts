import { createAPIFileRoute } from "@tanstack/react-start/api";
import { deleteAdminSession } from "@/lib/admin/auth";

export const APIRoute = createAPIFileRoute("/api/admin/logout")({
  POST: async ({ request }) => {
    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
    if (match) {
      const token = decodeURIComponent(match[1]);
      await deleteAdminSession(token).catch(() => {});
    }

    const clearCookie = [
      "admin_token=",
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
      ...(process.env["NODE_ENV"] === "production" ? ["Secure"] : []),
    ].join("; ");

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearCookie,
        },
      }
    );
  },
});
