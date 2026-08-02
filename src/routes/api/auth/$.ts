import { createAPIFileRoute } from "@tanstack/react-start/api";
import { auth } from "@/lib/auth/server";

export const APIRoute = createAPIFileRoute("/api/auth/$")({
  GET: async ({ request }) => auth.handler(request),
  POST: async ({ request }) => auth.handler(request),
});
