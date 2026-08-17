import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// Auth module cached after first use — NOT pre-warmed at module load time
// because db() reads process.env which isn't populated until the first request
let authModulePromise: Promise<{ auth: { handler: (req: Request) => Promise<Response> } }> | undefined;

function getAuthModule() {
  if (!authModulePromise) {
    authModulePromise = import("./lib/auth/server");
  }
  return authModulePromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Record<string, string>, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname.startsWith("/api/auth/")) {
        // Throttle sign-in / sign-up by client IP to blunt credential stuffing.
        // (nginx forwards the real IP in x-forwarded-for.)
        if (url.pathname.includes("/sign-in") || url.pathname.includes("/sign-up")) {
          const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
          const { rateLimit } = await import("./lib/rateLimit");
          if (!rateLimit(`authlogin:ip:${ip}`, 10, 60_000)) {
            return new Response(
              JSON.stringify({ error: "Too many attempts. Please wait a minute and try again." }),
              { status: 429, headers: { "content-type": "application/json" } },
            );
          }
        }
        const { auth } = await getAuthModule();
        return auth.handler(request);
      }

      // POK payment webhook — routed here explicitly because literal-path API
      // file routes are not served by the server entry in this build.
      if (url.pathname === "/api/pokpay/webhook" && request.method === "POST") {
        const { handlePokWebhook } = await import("./lib/pokWebhook");
        return handlePokWebhook(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
