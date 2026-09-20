import { query } from '../lib/db';
import { syncAccountPhotos } from '../lib/drive-scanner';

/**
 * Background worker to discover and ingest newly added photos from connected Google Drive accounts.
 * Can be run on a schedule (cron) or as a standalone background daemon.
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

// Allow direct execution: node --env-file=.env.local --import tsx workers/sync-worker.ts
if (require.main === module || process.argv[1]?.includes('sync-worker')) {
  runLibrarySync()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal sync worker error:', err);
      process.exit(1);
    });
}
