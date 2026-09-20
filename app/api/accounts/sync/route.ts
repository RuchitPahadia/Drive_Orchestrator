/**
 * @file app/api/accounts/sync/route.ts
 * @description Triggers Google Drive library scanning and differential ingestion.
 * Supports both targeted single-account sync and global cluster-wide synchronization.
 * @phase Phase 11: Google Drive Library Sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { syncAccountPhotos, SyncAccountResult } from '@/lib/drive-scanner';

/**
 * POST: Initiates a library sync across one or all connected Google Drive accounts.
 * 
 * @param request - JSON body with optional `{ accountId: string }`. If omitted or `'all'`,
 * all connected accounts for the user are scanned sequentially.
 * @returns NextResponse with summary counts of discovered, imported, and skipped photos.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    let body: { accountId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional; defaults to syncing all accounts if not specified
    }

    const { accountId } = body;

    // === Mode 1: Targeted Single-Account Sync ===
    if (accountId && accountId !== 'all') {
      const result = await syncAccountPhotos(accountId, userId);
      return NextResponse.json({
        success: true,
        message: `Synced ${result.syncedCount} new photo(s) from ${result.accountEmail} (${result.skippedCount} existing skipped).`,
        result,
      });
    }

    // === Mode 2: Global Account Sync (Entire Cluster) ===
    const accountsRes = await query(
      `SELECT id, google_email FROM accounts WHERE user_id = $1`,
      [userId]
    );

    if (accountsRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'No Google Drive accounts connected. Connect an account first.' },
        { status: 400 }
      );
    }

    const results: SyncAccountResult[] = [];
    let totalSynced = 0;
    let totalDiscovered = 0;

    for (const account of accountsRes.rows) {
      try {
        const syncResult = await syncAccountPhotos(account.id, userId);
        results.push(syncResult);
        totalSynced += syncResult.syncedCount;
        totalDiscovered += syncResult.totalDiscovered;
      } catch (err) {
        console.error(`Failed to sync account ${account.id} (${account.google_email}):`, err);
        results.push({
          accountId: account.id,
          accountEmail: account.google_email,
          totalDiscovered: 0,
          syncedCount: 0,
          skippedCount: 0,
          newPhotoIds: [],
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync complete across ${accountsRes.rows.length} accounts. Imported ${totalSynced} new photo(s) (${totalDiscovered} total found).`,
      totalAccounts: accountsRes.rows.length,
      totalSynced,
      totalDiscovered,
      results,
    });
  } catch (error) {
    console.error('Error during library sync:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during sync';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
