/**
 * @file lib/rate-limit.ts
 * @description Dependency-free in-memory fixed-window rate limiter.
 *
 * NOTE: state lives in-process, so on serverless/multi-instance deployments each instance
 * limits independently. It is a basic abuse guard, not a distributed quota — back it with
 * Redis (e.g. @upstash/ratelimit) if you need cross-instance accuracy. Kept pure and
 * dependency-free so it is unit-testable in isolation.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets (0 when allowed with headroom). */
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limit check. Call once per request with a stable `key`
 * (e.g. `search:<userId>`). Returns whether the request is allowed.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  // Opportunistic cleanup so the map can't grow unbounded over time.
  if (store.size > 10_000) {
    for (const [k, b] of store) {
      if (now >= b.resetAt) store.delete(k);
    }
  }

  const bucket = store.get(key);
  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count < limit) {
    bucket.count += 1;
    return { allowed: true, limit, remaining: limit - bucket.count, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    limit,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Test-only: clear all buckets. */
export function __resetRateLimitStore() {
  store.clear();
}
