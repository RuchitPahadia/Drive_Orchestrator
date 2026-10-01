/**
 * @file workers/sync-worker.ts
 * @description Standalone background sync daemon.
 * Periodically or on-demand iterates through all connected Google Drive accounts, performs differential
 * discovery of untracked photos, ingests them into PostgreSQL, and enqueues indexing.
 * Can be run via CLI script: `npm run sync-worker`.
 * @phase Phase 11: Google Drive Library Sync
 */

import { query } from '../lib/db';
import { syncAccountPhotos } from '../lib/drive-scanner';
import { enqueueIndexing } from '../lib/indexing-scheduler';
import { indexPhoto } from '../lib/indexer';

/**
 * Background worker execution loop to discover and ingest newly added photos from connected Google Drive accounts.
 * Can be scheduled as a recurring cron job or invoked as an ephemeral worker container.
 */
export async function runLibrarySync() {
  console.log('--- 🔄 Running Google Drive Library Sync ---');

  try {
    const accountsRes = await query(
      `SELECT id, user_id, google_email FROM accounts ORDER BY created_at ASC`
    );

    if (accountsRes.rows.length === 0) {
      console.log('[SyncWorker] No connected Google Drive accounts found.');
      return;
    }

    console.log(`[SyncWorker] Found ${accountsRes.rows.length} accounts to scan.`);

    let totalDiscovered = 0;
    let totalImported = 0;

    for (const acc of accountsRes.rows) {
      try {
        console.log(`[SyncWorker] Scanning account: ${acc.google_email} (${acc.id})...`);
        const result = await syncAccountPhotos(acc.id, acc.user_id);
        totalDiscovered += result.totalDiscovered;
        totalImported += result.syncedCount;

        // Schedule indexing for newly ingested photos: enqueue if Redis is
        // configured, otherwise index inline (safe here — this is a long-lived worker).
        for (const photoId of result.newPhotoIds) {
          const queued = await enqueueIndexing(photoId);
          if (!queued) {
            try {
              await indexPhoto(photoId);
            } catch (indexErr) {
              console.error(`[SyncWorker] Inline indexing failed for photo ${photoId}:`, indexErr);
            }
          }
        }

        console.log(
          `[SyncWorker] Account ${acc.google_email}: Discovered ${result.totalDiscovered}, ` +
          `Imported ${result.syncedCount} new, Skipped ${result.skippedCount} existing.`
        );
      } catch (accErr) {
        console.error(`[SyncWorker] Error syncing account ${acc.google_email}:`, accErr);
      }
    }

    console.log(`\n✅ Library Sync complete! Total images discovered: ${totalDiscovered}, Newly imported: ${totalImported}.\n`);
  } catch (err) {
    console.error('[SyncWorker] Fatal error during sync:', err);
  }
}

/**
 * Direct CLI Execution Guard:
 * Allows the script to be executed directly from terminal or docker container via:
 * `node --env-file=.env.local --import tsx workers/sync-worker.ts`
 */
if (require.main === module || process.argv[1]?.includes('sync-worker')) {
  runLibrarySync()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal sync worker error:', err);
      process.exit(1);
    });
}
