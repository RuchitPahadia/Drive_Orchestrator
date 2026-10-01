/**
 * @file lib/api-utils.ts
 * @description Small shared helpers for API route handlers: session/auth guards,
 * query-parameter parsing, and standardized error responses. Extracted to remove
 * logic that was previously copy-pasted across ~8 route handlers.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { logger } from '@/lib/logger';

export const DEFAULT_PAGE_LIMIT = 30;
export const MAX_PAGE_LIMIT = 100;

/**
 * Resolve the authenticated user from the session, or `null` if unauthenticated.
 * Prefer this over inlining `auth()` + id checks in every handler.
 */
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

/** Standard 401 JSON response. */
export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Standard 500 JSON response. Logs the full error server-side and returns a
 * generic message so internal/driver details are never leaked to the client.
 */
export function serverError(context: string, error: unknown, clientMessage = 'Something went wrong. Please try again.') {
  logger.error(`[${context}]`, error);
  return NextResponse.json({ error: clientMessage }, { status: 500 });
}

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
