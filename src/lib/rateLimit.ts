// Simple in-memory sliding-window rate limiter.
//
// The app runs as a single node-server process on the VPS, so a module-level
// map is sufficient. It resets on restart, which is acceptable for abuse
// prevention — an attacker still cannot sustain a high request rate, and the
// primary control (per-user, behind auth) ties every attempt to an account.

const buckets = new Map<string, number[]>();

// Defensive cap so the map can't grow unbounded under a distributed attack.
const MAX_KEYS = 50_000;

/**
 * Returns true if the action is allowed, false if the caller has exceeded
 * `limit` actions within the trailing `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    buckets.set(key, hits); // persist the pruned list
    return false;
  }

  hits.push(now);

  if (buckets.size >= MAX_KEYS && !buckets.has(key)) {
    // Evict a stale/arbitrary entry to bound memory under attack.
    const oldest = buckets.keys().next().value;
    if (oldest !== undefined) buckets.delete(oldest);
  }

  buckets.set(key, hits);
  return true;
}
