/**
 * @file lib/storage-router.ts
 * @description Storage routing engine: dynamically distributes file uploads across connected
 * Google Drive accounts based on available storage capacity and user redundancy preferences.
 * Implements capacity-aware load balancing and configurable multi-account replication.
 * @phase Phase 4: Storage Router & Upload & Phase 10: Configurable Replication
 */

import { query } from './db';
import { refreshAccountQuota } from './drive-client';

/** Quota staleness threshold: re-fetch from Google Drive if older than 10 minutes */
const QUOTA_STALENESS_THRESHOLD_MS = 10 * 60 * 1000;

export interface StorageRouterResult {
  accountIds: string[];
  replicationFactor: number;
  availableAccountsCount: number;
}

/**
 * Evaluates the connected storage accounts for a user and chooses the optimal accounts
 * to receive a new file based on available storage space and user-configured replication factor.
 *
 * Accounts are ranked by free space (bytes remaining) descending to evenly distribute load.
 *
 * @param userId - The UUID of the application user.
 * @param fileSizeBytes - The size of the file to be uploaded, in bytes.
 * @param overrideReplicationFactor - Optional override for testing or manual uploads.
 * @throws {Error} If no accounts are connected or if no accounts have sufficient free storage.
 * @returns Promise resolving to an array of selected account UUIDs.
 */
export async function pickAccountsForUpload(
  userId: string,
  fileSizeBytes: number,
  overrideReplicationFactor?: number
): Promise<string[]> {
  // 1. Fetch user's configured replication_factor (defaulting to 2 if not set)
  let targetReplication: number = typeof overrideReplicationFactor === 'number' ? overrideReplicationFactor : 2;

  if (overrideReplicationFactor === undefined || overrideReplicationFactor === null) {
    const userRes = await query(
      `SELECT replication_factor FROM users WHERE id = $1`,
      [userId]
    );
    if (userRes.rows.length > 0 && typeof userRes.rows[0].replication_factor === 'number') {
      targetReplication = userRes.rows[0].replication_factor;
    } else {
      targetReplication = 2; // Default dual-replica
    }
  }

  // Ensure targetReplication is at least 1
  targetReplication = Math.max(1, targetReplication);

  // 2. Fetch all connected accounts for the user
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

  // 3. Refresh quotas if they are missing or older than 10 minutes
  for (const account of accounts) {
    const checkedAt = account.quota_checked_at ? new Date(account.quota_checked_at) : null;
    const isStale = !checkedAt || (now.getTime() - checkedAt.getTime() > QUOTA_STALENESS_THRESHOLD_MS);

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

  // 4. Calculate available storage and filter accounts that have enough space
  // Note: pg returns PostgreSQL BIGINT columns as strings in JavaScript to prevent IEEE 754 precision loss,
  // so we parse them to numbers safely.
  const eligibleAccounts = accounts
    .map(acc => {
      const total = typeof acc.quota_total_bytes === 'string' ? parseInt(acc.quota_total_bytes, 10) : (acc.quota_total_bytes || 0);
      const used = typeof acc.quota_used_bytes === 'string' ? parseInt(acc.quota_used_bytes, 10) : (acc.quota_used_bytes || 0);
      const free = total - used;
      return {
        id: acc.id as string,
        total,
        used,
        free,
      };
    })
    .filter(acc => acc.free >= fileSizeBytes);

  if (eligibleAccounts.length === 0) {
    const sizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
    throw new Error(`Insufficient storage space. None of your connected Google Drive accounts have ${sizeMB} MB of free space remaining.`);
  }

  // 5. Rank eligible accounts by remaining free bytes descending (highest free capacity first)
  eligibleAccounts.sort((a, b) => b.free - a.free);

  // 6. Select the top N accounts up to targetReplication (or all eligible if targetReplication >= eligibleAccounts.length)
  const selectedCount = Math.min(targetReplication, eligibleAccounts.length);
  const selectedAccounts = eligibleAccounts.slice(0, selectedCount);

  console.log(
    `[StorageRouter] User ${userId}: Configured replication factor = ${targetReplication}. ` +
    `Found ${eligibleAccounts.length} eligible accounts. Selected top ${selectedAccounts.length} accounts: ${selectedAccounts.map(a => a.id).join(', ')}`
  );

  return selectedAccounts.map(acc => acc.id);
}
