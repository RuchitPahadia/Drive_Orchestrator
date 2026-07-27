import { query } from './db';
import { refreshAccountQuota } from './drive-client';

/**
 * Evaluates the connected storage accounts for a user and chooses the most appropriate one
 * to receive a new file based on available storage space and lowest utilization ratio.
 *
 * @param userId The ID of the application user.
 * @param fileSizeBytes The size of the file to be uploaded, in bytes.
 * @returns The UUID of the selected account.
 */
export async function pickAccountForUpload(userId: string, fileSizeBytes: number): Promise<string> {
  // 1. Fetch all connected accounts for the user
  const result = await query(
    `SELECT id, quota_total_bytes, quota_used_bytes, quota_checked_at 
     FROM accounts 
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('No Google Drive accounts are connected. Please connect a storage account in the dashboard first.');
  }

  const accounts = result.rows;
  const now = new Date();
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  // 2. Refresh quotas if they are missing or older than 10 minutes
  for (const account of accounts) {
    const checkedAt = account.quota_checked_at ? new Date(account.quota_checked_at) : null;
    const isStale = !checkedAt || (now.getTime() - checkedAt.getTime() > TEN_MINUTES_MS);

    if (isStale) {
      try {
        console.log(`Quota for account ${account.id} is stale. Refreshing from Google Drive...`);
        const freshQuota = await refreshAccountQuota(account.id);
        account.quota_total_bytes = freshQuota.quotaTotalBytes;
        account.quota_used_bytes = freshQuota.quotaUsedBytes;
      } catch (error) {
        console.error(`Failed to refresh quota for account ${account.id} during upload routing:`, error);
        // Fallback: continue using the stored database values if the refresh fails
      }
    }
  }

  // 3. Filter accounts that have enough space
  // Note: pg returns BIGINT as strings, so we parse them to numbers safely.
  const eligibleAccounts = accounts
    .map(acc => ({
      id: acc.id as string,
      total: typeof acc.quota_total_bytes === 'string' ? parseInt(acc.quota_total_bytes, 10) : (acc.quota_total_bytes || 0),
      used: typeof acc.quota_used_bytes === 'string' ? parseInt(acc.quota_used_bytes, 10) : (acc.quota_used_bytes || 0),
    }))
    .filter(acc => (acc.total - acc.used) >= fileSizeBytes);

  if (eligibleAccounts.length === 0) {
    const sizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
    throw new Error(`Insufficient storage space. None of your connected Google Drive accounts have ${sizeMB} MB of free space remaining.`);
  }

  // 4. Return the account with the lowest utilization ratio (used / total)
  // This balances storage usage evenly across connected accounts.
  eligibleAccounts.sort((a, b) => {
    const ratioA = a.total > 0 ? a.used / a.total : 1;
    const ratioB = b.total > 0 ? b.used / b.total : 1;
    return ratioA - ratioB;
  });

  return eligibleAccounts[0].id;
}
