/**
 * @file lib/drive-client.ts
 * @description Authenticated Google Drive API client factory with proactive token refresh,
 * encrypted credential management, and Drive quota interrogation.
 * @phase Phase 3: OAuth Connect & Phase 4: Storage Router
 */

import { google } from 'googleapis';
import { getOAuth2Client } from './google-oauth';
import { decrypt, encrypt } from './crypto';
import { query } from './db';

/** Refresh tokens proactively if expiry is within 5 minutes (300,000 ms) */
const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;

/**
 * Creates and returns an authenticated Google Drive client for a specific account.
 * Automatically refreshes the access token if it is expired or close to expiry (within 5 minutes)
 * and updates the database with the new encrypted token.
 * 
 * @param accountId - UUID of the connected account in the PostgreSQL database.
 * @throws {Error} If the account is not found in the database.
 * @returns Authenticated googleapis Drive v3 client instance.
 */
export async function getDriveClient(accountId: string) {
  // 1. Fetch encrypted account credentials from the database
  const accountResult = await query(
    `SELECT access_token, refresh_token, token_expiry 
     FROM accounts 
     WHERE id = $1`,
    [accountId]
  );

  if (accountResult.rows.length === 0) {
    throw new Error(`Account with ID ${accountId} not found in database`);
  }

  const { access_token: encryptedAccess, refresh_token: encryptedRefresh, token_expiry: tokenExpiry } = accountResult.rows[0];

  const accessToken = decrypt(encryptedAccess);
  const refreshToken = decrypt(encryptedRefresh);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: tokenExpiry ? new Date(tokenExpiry).getTime() : undefined,
  });

  // 2. Check if access token is expired or close to expiring (within 5-minute safety margin)
  const now = new Date();
  const isCloseToExpiry = tokenExpiry && (new Date(tokenExpiry).getTime() - now.getTime() < TOKEN_REFRESH_WINDOW_MS);

  if (!tokenExpiry || isCloseToExpiry) {
    try {
      console.log(`Refreshing access token for account ${accountId}...`);
      const refreshed = await oauth2Client.refreshAccessToken();
      const newAccess = refreshed.credentials.access_token;
      const newExpiryDate = refreshed.credentials.expiry_date ? new Date(refreshed.credentials.expiry_date) : null;

      if (newAccess) {
        const encryptedNewAccess = encrypt(newAccess);
        await query(
          `UPDATE accounts 
           SET access_token = $1, token_expiry = $2 
           WHERE id = $3`,
          [encryptedNewAccess, newExpiryDate, accountId]
        );
        oauth2Client.setCredentials({
          access_token: newAccess,
          refresh_token: refreshToken,
          expiry_date: newExpiryDate ? newExpiryDate.getTime() : undefined,
        });
      }
    } catch (error) {
      console.error(`Failed to manually refresh access token for account ${accountId}:`, error);
      // Fallback: oauth2Client will attempt automatic refresh when requests are made
    }
  }

  // 3. Register token refresh listener to capture any auto-refreshes triggered by request execution
  // @security Ensures that tokens refreshed autonomously by the googleapis library are re-encrypted
  // and persisted to PostgreSQL immediately, preventing token invalidation loops.
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      console.log(`Auto-refreshed access token detected for account ${accountId}, updating database...`);
      const encryptedNewAccess = encrypt(tokens.access_token);
      const newExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
      
      try {
        await query(
          `UPDATE accounts 
           SET access_token = $1, token_expiry = $2 
           WHERE id = $3`,
          [encryptedNewAccess, newExpiry, accountId]
        );
      } catch (dbError) {
        console.error(`Failed to store auto-refreshed token for account ${accountId}:`, dbError);
      }
    }
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Fetches the storage quota of a connected account from Google Drive
 * and updates the database record.
 * 
 * @param accountId - UUID of the connected account.
 * @throws {Error} If Google Drive API does not return storage quota details.
 * @returns Object containing updated total and used storage bytes.
 */
export async function refreshAccountQuota(accountId: string) {
  const drive = await getDriveClient(accountId);
  
  // Get storage metadata from Google Drive
  const aboutRes = await drive.about.get({
    fields: 'storageQuota',
  });

  const quota = aboutRes.data.storageQuota;
  if (!quota) {
    throw new Error(`Failed to retrieve storage quota details from Google Drive for account ${accountId}`);
  }

  const limit = quota.limit ? parseInt(quota.limit, 10) : 0;
  const usage = quota.usage ? parseInt(quota.usage, 10) : 0;

  // Update quota bytes in PostgreSQL
  await query(
    `UPDATE accounts 
     SET quota_total_bytes = $1, quota_used_bytes = $2, quota_checked_at = NOW() 
     WHERE id = $3`,
    [limit, usage, accountId]
  );

  return {
    quotaTotalBytes: limit,
    quotaUsedBytes: usage,
  };
}
