/**
 * Unit tests for the shared parseLimit() query-parameter validator (lib/api-utils.ts).
 */
import { describe, it, expect } from 'vitest';
import { parseLimit, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/lib/pagination';

describe('parseLimit', () => {
  it('returns the default when the value is absent', () => {
    expect(parseLimit(null)).toBe(DEFAULT_PAGE_LIMIT);
  });

  it('honors a custom default', () => {
    expect(parseLimit(null, { def: 20, max: 50 })).toBe(20);
  });

  it('parses a valid in-range integer', () => {
    expect(parseLimit('10')).toBe(10);
    expect(parseLimit(String(MAX_PAGE_LIMIT))).toBe(MAX_PAGE_LIMIT);
  });

  it('rejects values above the max', () => {
    expect(parseLimit(String(MAX_PAGE_LIMIT + 1))).toBeNull();
    expect(parseLimit('51', { def: 20, max: 50 })).toBeNull();
  });

  it('rejects zero, negatives, and non-integers', () => {
    expect(parseLimit('0')).toBeNull();
    expect(parseLimit('-5')).toBeNull();
    expect(parseLimit('3.5')).toBeNull();
    expect(parseLimit('abc')).toBeNull();
    expect(parseLimit('10abc')).toBeNull();
  });
});
