/**
 * Unit tests for the in-memory fixed-window rate limiter (lib/rate-limit.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, __resetRateLimitStore } from '@/lib/rate-limit';

beforeEach(() => __resetRateLimitStore());

describe('rateLimit', () => {
  it('allows requests up to the limit, then blocks', () => {
    const key = 'user:a';
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000, t).allowed).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000, t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('reports decreasing remaining count', () => {
    const key = 'user:b';
    expect(rateLimit(key, 5, 60_000, 0).remaining).toBe(4);
    expect(rateLimit(key, 5, 60_000, 0).remaining).toBe(3);
  });

  it('resets after the window elapses', () => {
    const key = 'user:c';
    expect(rateLimit(key, 1, 1_000, 0).allowed).toBe(true);
    expect(rateLimit(key, 1, 1_000, 500).allowed).toBe(false);
    expect(rateLimit(key, 1, 1_000, 1_000).allowed).toBe(true); // new window
  });

  it('tracks separate keys independently', () => {
    expect(rateLimit('x', 1, 60_000, 0).allowed).toBe(true);
    expect(rateLimit('y', 1, 60_000, 0).allowed).toBe(true);
    expect(rateLimit('x', 1, 60_000, 0).allowed).toBe(false);
  });
});
