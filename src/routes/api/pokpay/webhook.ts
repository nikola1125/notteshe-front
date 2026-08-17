import { createAPIFileRoute } from "@tanstack/react-start/api";
import { handlePokWebhook } from "@/lib/pokWebhook";

// NOTE: In this build, literal-path API file routes are not actually served by
// the server entry — the POK webhook is routed explicitly in src/server.ts.
// This file delegates to the same secured handler so the two never diverge (and
// so it's correct if the build ever starts serving file routes).
export const APIRoute = createAPIFileRoute("/api/pokpay/webhook")({
  POST: async ({ request }) => handlePokWebhook(request),
});
