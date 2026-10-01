/**
 * @file lib/google-oauth.ts
 * @description Google OAuth2 client factory and authorization consent URL generator.
 * Manages Google Drive storage account linking with least-privilege scoping.
 * @phase Phase 3: OAuth Connect + Callback
 */

import { google } from 'googleapis';

/**
 * Creates and returns an authenticated Google OAuth2 client configured with application credentials.
 * 
 * @throws {Error} If GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI are not set.
 * @returns An instance of google.auth.OAuth2 configured for token generation and refresh.
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI) in .env.local');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates the Google OAuth consent screen URL.
 * Requests offline access type and consent prompt to guarantee a refresh token is returned.
 * 
 * @security Scopes requested:
 * - `https://www.googleapis.com/auth/drive.file`: Least-privilege scope that grants access
 *   ONLY to files created or opened by this application. Unlike the broad `drive` scope which
 *   requests read/write to the user's entire Drive, `drive.file` protects existing private files.
 * - `https://www.googleapis.com/auth/userinfo.email`: Used to identify the connected account email.
 *
 * @param state - Opaque anti-CSRF token echoed back by Google on the callback. The caller stores
 *   the same value in a short-lived httpOnly cookie and verifies it in the callback to prevent
 *   OAuth login/account-linking CSRF.
 * @returns Fully formatted Google OAuth authorization URL redirecting to Google's consent dialog.
 */
export function generateAuthUrl(state?: string) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Request offline access to guarantee a refresh token is returned
    prompt: 'consent',      // Force consent screen to always receive a fresh refresh token on reconnect
    ...(state ? { state } : {}),
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
}
