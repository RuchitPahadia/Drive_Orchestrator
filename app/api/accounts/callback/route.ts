/**
 * @file app/api/accounts/callback/route.ts
 * @description Google OAuth2 callback endpoint: handles authorization code exchange,
 * fetches user profile information, encrypts OAuth tokens with AES-256-GCM, and
 * links the storage account to the authenticated user in PostgreSQL.
 * @phase Phase 3: OAuth Connect + Callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOAuth2Client } from '@/lib/google-oauth';
import { encrypt } from '@/lib/crypto';
import { query } from '@/lib/db';
import { google } from 'googleapis';

/**
 * GET: Handles the redirect callback from Google OAuth consent flow.
 * 
 * @param request - Next.js request with 'code' or 'error' query parameters.
 * @returns NextResponse redirecting back to /dashboard with success or error alerts.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

  // Handle errors emitted by Google (e.g. user cancelled consent)
  if (errorParam) {
    console.error('Google OAuth redirect error:', errorParam);
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(`Google login error: ${errorParam}`)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent('No authorization code provided by Google.')}`, request.url)
    );
  }

  try {
    const oauth2Client = getOAuth2Client();
    
    // Exchange the one-time authorization code for permanent access and refresh tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch the connected user's profile info to identify the Google Account email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfoResponse = await oauth2.userinfo.get();
    const googleEmail = userInfoResponse.data.email;

    if (!googleEmail) {
      throw new Error('Could not retrieve email address from Google Account profile info');
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    if (!accessToken) {
      throw new Error('Access token was not returned by Google');
    }
    
    // Note: Google OAuth only returns a refresh_token on the first consent prompt unless prompt='consent'
    if (!refreshToken) {
      throw new Error('Refresh token was not returned by Google. If this account was connected before, please remove app access in Google settings and retry.');
    }

    // @security Encrypt both access and refresh tokens using AES-256-GCM before database insertion
    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = encrypt(refreshToken);
    const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    // 1. Resolve currently authenticated user session
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(
        new URL('/login?error=PleaseSignInFirst', request.url)
      );
    }
    const userId = session.user.id;

    // 2. Insert or update the account record in PostgreSQL
    const existingAccountResult = await query(
      `SELECT id FROM accounts WHERE user_id = $1 AND google_email = $2`,
      [userId, googleEmail]
    );

    if (existingAccountResult.rows.length > 0) {
      // Re-connecting existing account: update credentials and reset quota timestamp to trigger refresh
      await query(
        `UPDATE accounts 
         SET access_token = $1, refresh_token = $2, token_expiry = $3, quota_checked_at = NULL 
         WHERE user_id = $4 AND google_email = $5`,
        [encryptedAccess, encryptedRefresh, expiryDate, userId, googleEmail]
      );
    } else {
      // Registering new account into user's storage pool
      await query(
        `INSERT INTO accounts (user_id, google_email, access_token, refresh_token, token_expiry) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, googleEmail, encryptedAccess, encryptedRefresh, expiryDate]
      );
    }

    return NextResponse.redirect(
      new URL('/dashboard?success=Account connected successfully!', request.url)
    );
  } catch (error) {
    console.error('OAuth callback error details:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred during token exchange';
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorMsg)}`, request.url)
    );
  }
}
