import { google } from 'googleapis';
import { getOAuth2Client } from './google-oauth';
import { decrypt, encrypt } from './crypto';
import { query } from './db';

/**
 * Creates and returns an authenticated Google Drive client for a specific account.
 * Automatically refreshes the access token if it is expired or close to expiry (within 5 minutes)
 * and updates the database.
 */
export async function getDriveClient(accountId: string) {
  // 1. Fetch account credentials from the database
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

  // 2. Check if access token is expired or close to expiring (within 5 minutes)
  const now = new Date();
  const isCloseToExpiry = tokenExpiry && (new Date(tokenExpiry).getTime() - now.getTime() < 5 * 60 * 1000);

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

  // Update in DB
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
