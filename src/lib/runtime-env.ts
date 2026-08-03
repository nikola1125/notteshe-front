// Cloudflare Workers passes env bindings as the second argument to fetch().
// We store them on globalThis so they're accessible across all bundled chunks —
// module-level variables are NOT shared when Nitro splits code into multiple chunks.

type GlobalWithEnv = typeof globalThis & { __cf_env__?: Record<string, string> };

export function setRuntimeEnv(env: Record<string, string>) {
  (globalThis as GlobalWithEnv).__cf_env__ = env;
}

export function getRuntimeEnv(key: string): string | undefined {
  return (globalThis as GlobalWithEnv).__cf_env__?.[key] ?? process.env[key];
}
