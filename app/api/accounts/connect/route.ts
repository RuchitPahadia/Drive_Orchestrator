/**
 * @file app/api/accounts/connect/route.ts
 * @description Initiates Google OAuth consent flow for linking a new Google Drive storage account
 * to the currently logged-in user's storage pool.
 * @phase Phase 3: OAuth Connect + Callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/auth';
import { generateAuthUrl } from '@/lib/google-oauth';

/** Name of the short-lived httpOnly cookie holding the OAuth anti-CSRF state token. */
export const OAUTH_STATE_COOKIE = 'oauth_state';

/**
 * GET: Verifies the session and redirects the browser to Google's OAuth consent screen.
 *
 * @security Generates a random `state` token, stores it in a short-lived httpOnly cookie,
 * and passes it to Google. The callback verifies the echoed state against the cookie to
 * prevent OAuth account-linking CSRF.
 *
 * @param request - Incoming Next.js HTTP request.
 * @returns NextResponse redirecting to the Google OAuth authorization URL.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login?error=PleaseSignInFirst', request.url));
    }

    const state = randomBytes(32).toString('hex');
    const authUrl = generateAuthUrl(state);
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes to complete the consent flow
    });
    return response;
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    return new NextResponse('Failed to initiate Google connection.', { status: 500 });
  }
}
