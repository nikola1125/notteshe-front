const PROJECT_ID = "y3svsr7kjm";

// Cached script text — refreshed every hour so we're not fetching on every page load.
let cachedScript: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function handleClarityTag(): Promise<Response> {
  try {
    const now = Date.now();
    if (!cachedScript || now - cachedAt > CACHE_TTL_MS) {
      const upstream = await fetch(`https://www.clarity.ms/tag/${PROJECT_ID}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; notteshe-proxy/1.0)" },
      });
      if (!upstream.ok) {
        return new Response("", { status: upstream.status });
      }
      let script = await upstream.text();
      // Rewrite all data-collection calls to go through our domain.
      // Clarity sends session data to s.clarity.ms — we proxy that too.
      script = script.replaceAll("https://s.clarity.ms", "/clarity/s");
      script = script.replaceAll("//s.clarity.ms", "/clarity/s");
      cachedScript = script;
      cachedAt = now;
    }
    return new Response(cachedScript, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("", { status: 502 });
  }
}

// Proxy all requests to s.clarity.ms (session data collection).
// subpath example: "/collect" — full upstream URL becomes https://s.clarity.ms/collect
export async function handleClarityCollect(request: Request, subpath: string): Promise<Response> {
  try {
    const upstreamUrl = `https://s.clarity.ms${subpath}${request.url.includes("?") ? "?" + new URL(request.url).search.slice(1) : ""}`;

    // Forward headers but strip connection-level and host headers
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      const lower = key.toLowerCase();
      if (lower === "host" || lower === "connection" || lower === "keep-alive") continue;
      headers.set(key, value);
    }

    // Read body as buffer so the stream isn't locked by the outer handler
    const body = request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : undefined;

    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
    });

    // Strip encoding/connection headers from the upstream response;
    // Bun's fetch() already decompresses the body.
    const responseHeaders = new Headers();
    for (const [key, value] of upstream.headers.entries()) {
      const lower = key.toLowerCase();
      if (lower === "content-encoding" || lower === "transfer-encoding" || lower === "connection") continue;
      responseHeaders.set(key, value);
    }
    // Allow our domain to make these requests
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response("", { status: 502 });
  }
}
