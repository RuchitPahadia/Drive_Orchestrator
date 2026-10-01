/**
 * @file lib/pagination.ts
 * @description Pure, dependency-free pagination/query-parameter helpers. Kept separate
 * from lib/api-utils.ts (which imports the auth stack) so they can be unit-tested in
 * isolation without pulling in next-auth.
 */

export const DEFAULT_PAGE_LIMIT = 30;
export const MAX_PAGE_LIMIT = 100;

/**
 * Parse and validate a `limit` query parameter.
 *
 * @returns the parsed limit, or `null` if the value is present but invalid
 * (non-integer, out of range). A missing value yields `def`.
 */
export function parseLimit(
  value: string | null,
  { def = DEFAULT_PAGE_LIMIT, max = MAX_PAGE_LIMIT }: { def?: number; max?: number } = {}
): number | null {
  if (value === null) return def;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}
