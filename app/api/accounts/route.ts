/**
 * @file app/api/accounts/route.ts
 * @description Account management endpoints: lists connected Google Drive accounts and
 * securely disconnects accounts with automated replica cascade cleanup.
 * @phase Phase 3: OAuth Connect + Callback & Phase 10: Account Management
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, unauthorized, serverError } from '@/lib/api-utils';

/**
 * GET: Fetches all connected Google Drive accounts associated with the authenticated user.
 * 
 * @returns NextResponse with JSON array of account objects (id, google_email, created_at).
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const userId = user.id;

    // Fetch all accounts associated with this user, sorted alphabetically by email
    const accountsResult = await query(
      `SELECT id, google_email, created_at
       FROM accounts
       WHERE user_id = $1
       ORDER BY google_email ASC`,
      [userId]
    );

    return NextResponse.json(accountsResult.rows);
  } catch (error) {
    return serverError('Accounts:list', error, 'Unable to load connected accounts right now');
  }
}

/**
 * DELETE: Disconnects and removes a Google Drive account from the user's storage pool.
 * Note: Database foreign key constraints (`ON DELETE CASCADE`) automatically remove all
 * physical replica records (`photo_replicas`) tied to this account.
 * 
 * @param request - HTTP request containing `?id=<accountId>` query parameter.
 * @returns NextResponse with JSON confirmation of deletion.
 */
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // 1. Verify that this account belongs to the logged-in user
    const checkRes = await query(
      'SELECT id, google_email FROM accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 });
    }

    const email = checkRes.rows[0].google_email;

    // 2. Delete the account row (photo_replicas cascade deletes automatically in Postgres)
    await query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [accountId, userId]);

    console.log(`[Account Manager] Disconnected account ${email} (ID: ${accountId}) for user ${userId}`);

    return NextResponse.json({
      message: `Account ${email} disconnected successfully.`,
      accountId,
    });
  } catch (error) {
    return serverError('Accounts:delete', error, 'Failed to remove the account right now');
  }
}
