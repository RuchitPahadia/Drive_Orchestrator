import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const accountId = searchParams.get('accountId');
    const camera = searchParams.get('camera');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    const offset = (page - 1) * pageSize;

    // 1. Resolve the hardcoded test user ID
    const testUserEmail = 'testuser@example.com';
    const userResult = await query('SELECT id FROM users WHERE email = $1', [testUserEmail]);
    
    if (userResult.rows.length === 0) {
      // Return empty response if the default test user doesn't exist yet
      return NextResponse.json({
        photos: [],
        total: 0,
        page,
        pageSize,
      });
    }
    const userId = userResult.rows[0].id;

    // 2. Build the WHERE conditions and query parameter values dynamically
    const conditions: string[] = ['p.user_id = $1'];
    const values: (string | number | Date)[] = [userId];

    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) {
        values.push(parsedStart);
        conditions.push(`p.taken_at >= $${values.length}`);
      }
    }

    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd.getTime())) {
        values.push(parsedEnd);
        conditions.push(`p.taken_at <= $${values.length}`);
      }
    }

    if (accountId) {
      values.push(accountId);
      conditions.push(`EXISTS (SELECT 1 FROM photo_replicas pr WHERE pr.photo_id = p.id AND pr.account_id = $${values.length})`);
    }

    if (camera) {
      values.push(`%${camera}%`);
      conditions.push(`p.camera_model ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 3. Fetch the total count of matching photos for pagination
    const countQuery = `SELECT COUNT(*) as total FROM photos p ${whereClause}`;
    const countResult = await query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // 4. Fetch the paginated photos list
    const paginatedValues: (string | number | Date)[] = [...values];
    
    // Add LIMIT
    paginatedValues.push(pageSize);
    const limitPlaceholder = `$${paginatedValues.length}`;
    
    // Add OFFSET
    paginatedValues.push(offset);
    const offsetPlaceholder = `$${paginatedValues.length}`;

    // Order by taken_at DESC (as specified), with a secondary fallback to created_at DESC for deterministic sorting
    const dataQuery = `
      SELECT p.id, p.filename, p.mime_type, p.size_bytes, p.taken_at, p.gps_lat, p.gps_lng, p.camera_model, p.thumbnail_url, p.created_at,
             (SELECT r.account_id FROM photo_replicas r WHERE r.photo_id = p.id LIMIT 1) as account_id,
             (SELECT r.drive_file_id FROM photo_replicas r WHERE r.photo_id = p.id LIMIT 1) as drive_file_id,
             ARRAY(SELECT r.account_id::text FROM photo_replicas r WHERE r.photo_id = p.id) as replica_account_ids
      FROM photos p
      ${whereClause} 
      ORDER BY p.taken_at DESC NULLS LAST, p.created_at DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const dataResult = await query(dataQuery, paginatedValues);

    return NextResponse.json({
      photos: dataResult.rows,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching photos list:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred during fetch';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
