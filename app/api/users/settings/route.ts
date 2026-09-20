import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(
      `SELECT id, email, name, role, replication_factor 
       FROM users 
       WHERE id = $1`,
      [session.user.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      settings: {
        replicationFactor: res.rows[0].replication_factor ?? 2,
        email: res.rows[0].email,
        name: res.rows[0].name,
        role: res.rows[0].role,
      },
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { replicationFactor } = body;

    if (
      typeof replicationFactor !== 'number' ||
      !Number.isInteger(replicationFactor) ||
      replicationFactor < 1 ||
      replicationFactor > 10
    ) {
      return NextResponse.json(
        { error: 'Replication factor must be an integer between 1 and 10.' },
        { status: 400 }
      );
    }

    const res = await query(
      `UPDATE users 
       SET replication_factor = $1 
       WHERE id = $2 
       RETURNING id, replication_factor`,
      [replicationFactor, session.user.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Replication factor updated to ${replicationFactor}x.`,
      replicationFactor: res.rows[0].replication_factor,
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
