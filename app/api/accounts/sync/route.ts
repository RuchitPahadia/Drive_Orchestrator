import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { syncAccountPhotos, SyncAccountResult } from '@/lib/drive-scanner';

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
      // Body is optional
    }

    const { accountId } = body;

    // Case 1: Sync a single specific account
    if (accountId && accountId !== 'all') {
      const result = await syncAccountPhotos(accountId, userId);
      return NextResponse.json({
        success: true,
        message: `Synced ${result.syncedCount} new photo(s) from ${result.accountEmail} (${result.skippedCount} existing skipped).`,
        result,
      });
    }

    // Case 2: Sync all connected accounts for the current user
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

    for (const acc of accountsRes.rows) {
      try {
        const res = await syncAccountPhotos(acc.id, userId);
        results.push(res);
        totalSynced += res.syncedCount;
        totalDiscovered += res.totalDiscovered;
      } catch (err) {
        console.error(`Failed to sync account ${acc.id} (${acc.google_email}):`, err);
        results.push({
          accountId: acc.id,
          accountEmail: acc.google_email,
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
