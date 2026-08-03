// Nitro's cloudflare-module preset sets globalThis.__env__ = env (all bindings including secrets)
// before calling the app handler. We read from there first, then fall back to process.env
// (which nodejs_compat_populate_process_env populates with plain vars from wrangler.json).

type GlobalWithEnv = typeof globalThis & { __env__?: Record<string, string> };

export function getRuntimeEnv(key: string): string | undefined {
  return (globalThis as GlobalWithEnv).__env__?.[key] ?? process.env[key];
}
