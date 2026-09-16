import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOAuth2Client } from '@/lib/google-oauth';
import { encrypt } from '@/lib/crypto';
import { query } from '@/lib/db';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

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
    
    // Exchange the authorization code for access and refresh tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch the connected user's profile info to get the email address
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
    
    // Note: Google only returns refresh_token on the first consent prompt.
    // If it's missing, let the user know they need to re-consent.
    if (!refreshToken) {
      throw new Error('Refresh token was not returned by Google. If this account was connected before, please remove app access in Google settings and retry.');
    }

    // Encrypt the credentials before storing in the database
    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = encrypt(refreshToken);
    const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    // 1. Resolve currently authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(
        new URL('/login?error=PleaseSignInFirst', request.url)
      );
    }
    const userId = session.user.id;

    // 2. Insert or update the account row.
    const existingAccountResult = await query(
      `SELECT id FROM accounts WHERE user_id = $1 AND google_email = $2`,
      [userId, googleEmail]
    );

    if (existingAccountResult.rows.length > 0) {
      // Update existing account with new tokens
      await query(
        `UPDATE accounts 
         SET access_token = $1, refresh_token = $2, token_expiry = $3, quota_checked_at = NULL 
         WHERE user_id = $4 AND google_email = $5`,
        [encryptedAccess, encryptedRefresh, expiryDate, userId, googleEmail]
      );
    } else {
      // Insert new account configuration
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
