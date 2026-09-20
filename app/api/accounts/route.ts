import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Fetch all accounts associated with this user
    const accountsResult = await query(
      `SELECT id, google_email, created_at 
       FROM accounts 
       WHERE user_id = $1 
       ORDER BY google_email ASC`,
      [userId]
    );

    return NextResponse.json(accountsResult.rows);
  } catch (error) {
    console.error('Error fetching accounts for select list:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // 1. Verify that this account belongs to the logged in user
    const checkRes = await query(
      'SELECT id, google_email FROM accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 });
    }

    const email = checkRes.rows[0].google_email;

    // 2. Delete the account row (photo_replicas cascade deletes automatically)
    await query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [accountId, userId]);

    console.log(`[Account Manager] Disconnected account ${email} (ID: ${accountId}) for user ${userId}`);

    return NextResponse.json({
      message: `Account ${email} disconnected successfully.`,
      accountId,
    });
  } catch (error) {
    console.error('Error removing account:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to remove account';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
