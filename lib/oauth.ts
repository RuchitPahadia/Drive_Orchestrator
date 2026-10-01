/**
 * @file lib/oauth.ts
 * @description Shared constants/helpers for the Google Drive account-linking OAuth flow,
 * imported by both the connect and callback route handlers (so neither route depends on the
 * other's module).
 */

/** Name of the short-lived httpOnly cookie holding the OAuth anti-CSRF state token. */
export const OAUTH_STATE_COOKIE = 'oauth_state';
