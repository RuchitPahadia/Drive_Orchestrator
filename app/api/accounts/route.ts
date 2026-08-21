import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // 1. Resolve the hardcoded test user ID
    const testUserEmail = 'testuser@example.com';
    const userResult = await query('SELECT id FROM users WHERE email = $1', [testUserEmail]);
    
    if (userResult.rows.length === 0) {
      return NextResponse.json([]);
    }
    const userId = userResult.rows[0].id;

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
