/**
 * @file lib/api-utils.ts
 * @description Small shared helpers for API route handlers: session/auth guards,
 * query-parameter parsing, and standardized error responses. Extracted to remove
 * logic that was previously copy-pasted across ~8 route handlers.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { logger } from '@/lib/logger';

// Re-export the pure pagination helpers so existing route imports from
// '@/lib/api-utils' keep working, while they remain independently testable.
export { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, parseLimit } from '@/lib/pagination';

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
