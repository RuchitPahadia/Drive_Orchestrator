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
