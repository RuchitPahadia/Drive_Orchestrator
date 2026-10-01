/**
 * @file app/api/admin/actions/route.ts
 * @description Administrative control endpoint: executes privileged cluster management operations
 * including system-wide storage quota refreshes, manual re-indexing of unindexed photos,
 * and multi-replica deletion with synchronized Google Drive file removal.
 * @phase Phase 7: Admin Panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { refreshAccountQuota, getDriveClient } from '@/lib/drive-client';
import { indexPhoto } from '@/lib/indexer';
import { getSessionUser, serverError } from '@/lib/api-utils';

/**
 * POST: Handles administrative cluster actions.
 * 
 * RBAC Enforcement:
 * Requires authenticated session with `role === 'admin'`. Non-admin sessions return 403 Forbidden.
 * 
 * Supported Actions:
 * - `refresh-quotas`: Queries Google Drive for latest quota metrics across all storage accounts.
 * - `trigger-indexing`: Backfills EXIF parsing and CLIP vector embeddings for photos lacking indexed_at.
 * - `delete-photo`: Purges photo from PostgreSQL and permanently deletes all Google Drive replicas.
 * 
 * @param request - Next.js request with JSON payload `{ action: string, photoId?: string }`.
 * @returns NextResponse with status confirmation or error details.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const { action, photoId } = await request.json();

    // === Action 1: Refresh Quotas Across All Storage Accounts ===
    if (action === 'refresh-quotas') {
      const accountsRes = await query('SELECT id FROM accounts');
      let updatedCount = 0;
      for (const acc of accountsRes.rows) {
        try {
          await refreshAccountQuota(acc.id);
          updatedCount++;
        } catch (err) {
          console.error(`Failed to refresh quota for account ${acc.id}:`, err);
        }
      }
      return NextResponse.json({ message: `Successfully refreshed storage quotas for ${updatedCount} account(s).` });
    }

    // === Action 2: Trigger Batch Indexing for Unindexed Photos ===
    if (action === 'trigger-indexing') {
      const unindexedRes = await query('SELECT id FROM photos WHERE indexed_at IS NULL');
      let indexedCount = 0;
      for (const photo of unindexedRes.rows) {
        try {
          await indexPhoto(photo.id);
          indexedCount++;
        } catch (err) {
          console.error(`Failed to index photo ${photo.id}:`, err);
        }
      }
      return NextResponse.json({ message: `Completed processing for ${indexedCount} unindexed photo(s).` });
    }

    // === Action 3: Permanently Delete Photo and Physical Drive Replicas ===
    if (action === 'delete-photo') {
      if (!photoId) {
        return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 });
      }

      // 1. Fetch file names and replica details for logging/deletion
      const photoRes = await query('SELECT filename FROM photos WHERE id = $1', [photoId]);
      if (photoRes.rows.length === 0) {
        return NextResponse.json({ error: 'Photo not found in database' }, { status: 404 });
      }
      const filename = photoRes.rows[0].filename;

      const replicasRes = await query(
        'SELECT account_id, drive_file_id FROM photo_replicas WHERE photo_id = $1',
        [photoId]
      );

      // 2. Delete replicas from Google Drive in parallel
      const deletePromises = replicasRes.rows.map(async (replica) => {
        try {
          const drive = await getDriveClient(replica.account_id);
          await drive.files.delete({ fileId: replica.drive_file_id });
          console.log(`Deleted Google Drive replica file ${replica.drive_file_id} for "${filename}"`);
        } catch (err) {
          console.error(`Failed to delete Google Drive replica ${replica.drive_file_id}:`, err);
        }
      });
      await Promise.all(deletePromises);

      // 3. Delete from database (cascades to photo_replicas via foreign key delete cascade)
      await query('DELETE FROM photos WHERE id = $1', [photoId]);

      return NextResponse.json({
        message: `Successfully deleted "${filename}" and its connected Google Drive replicas.`,
      });
    }

    return NextResponse.json({ error: 'Invalid action requested' }, { status: 400 });
  } catch (error) {
    return serverError('Admin Action', error, 'Unable to complete the admin action right now');
  }
}
