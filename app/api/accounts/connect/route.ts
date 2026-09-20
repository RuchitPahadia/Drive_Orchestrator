/**
 * @file app/api/accounts/connect/route.ts
 * @description Initiates Google OAuth consent flow for linking a new Google Drive storage account
 * to the currently logged-in user's storage pool.
 * @phase Phase 3: OAuth Connect + Callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateAuthUrl } from '@/lib/google-oauth';

/**
 * GET: Verifies the session and redirects the browser to Google's OAuth consent screen.
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

    const authUrl = generateAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new NextResponse(
      `Failed to initiate Google connection: ${errorMsg}`,
      { status: 500 }
    );
  }
}
