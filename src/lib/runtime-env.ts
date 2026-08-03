// Cloudflare Workers passes env bindings as the second argument to fetch().
// Dashboard secrets are only in env — process.env is empty unless
// nodejs_compat_populate_process_env flag is set in wrangler.toml.
let _env: Record<string, string> = {};

export function setRuntimeEnv(env: Record<string, string>) {
  _env = env;
}

export function getRuntimeEnv(key: string): string | undefined {
  return _env[key] ?? process.env[key];
}
