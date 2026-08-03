// Cloudflare Workers passes env bindings as the second argument to fetch().
// This module stores them so any server-side code can read them reliably.
let _env: Record<string, string> = {};

export function setRuntimeEnv(env: Record<string, string>) {
  _env = env;
}

export function getRuntimeEnv(key: string): string | undefined {
  return _env[key] ?? process.env[key];
}
