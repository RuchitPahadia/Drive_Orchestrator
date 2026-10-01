/**
 * @file app/api/photos/route.ts
 * @description Browse and filter API endpoint: queries user photos with dynamic filtering
 * (date range, storage account, camera model), pagination, and replica array aggregation.
 * @phase Phase 6: Search & Browse API
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, unauthorized, serverError } from '@/lib/api-utils';

/**
 * GET: Retrieves a paginated list of photos matching user-specified filter criteria.
 * 
 * @param request - Next.js request with query parameters:
 *   - `startDate`: ISO 8601 lower bound timestamp for taken_at.
 *   - `endDate`: ISO 8601 upper bound timestamp for taken_at.
 *   - `accountId`: UUID filter for photos having a replica in a specific Google Drive account.
 *   - `camera`: Case-insensitive substring match for camera_model.
 *   - `page`: Page index (default: 1).
 *   - `pageSize`: Items per page (default: 50).
 * @returns NextResponse with `{ photos, total, page, pageSize }`.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const userId = user.id;

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const accountId = searchParams.get('accountId');
    const camera = searchParams.get('camera');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    const offset = (page - 1) * pageSize;

    // Build parameterized WHERE conditions dynamically to ensure SQL injection safety
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
      // Fast EXISTS subquery leveraging photo_replicas index
      conditions.push(`EXISTS (SELECT 1 FROM photo_replicas pr WHERE pr.photo_id = p.id AND pr.account_id = $${values.length})`);
    }

    if (camera) {
      values.push(`%${camera}%`);
      conditions.push(`p.camera_model ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Fetch total matching records count for client pagination controls
    const countQuery = `SELECT COUNT(*) as total FROM photos p ${whereClause}`;
    const countResult = await query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Fetch paginated photo records with replica account IDs aggregated into an array
    const paginatedValues: (string | number | Date)[] = [...values];
    paginatedValues.push(pageSize);
    const limitPlaceholder = `$${paginatedValues.length}`;
    paginatedValues.push(offset);
    const offsetPlaceholder = `$${paginatedValues.length}`;

    // Sort by taken_at DESC with fallback to created_at DESC for deterministic pagination.
    // Replica details come from LEFT JOIN LATERAL (deterministic primary replica), matching
    // the pattern used by the search/similar routes.
    const dataQuery = `
      SELECT p.id, p.filename, p.mime_type, p.size_bytes, p.taken_at, p.gps_lat, p.gps_lng, p.camera_model, p.thumbnail_url, p.created_at,
             primary_replica.account_id,
             primary_replica.drive_file_id,
             COALESCE(replica_list.replica_account_ids, '{}') AS replica_account_ids
      FROM photos p
      LEFT JOIN LATERAL (
        SELECT r.account_id, r.drive_file_id
        FROM photo_replicas r
        WHERE r.photo_id = p.id
        ORDER BY r.created_at ASC, r.id ASC
        LIMIT 1
      ) primary_replica ON TRUE
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(r.account_id::text ORDER BY r.created_at ASC, r.id ASC) AS replica_account_ids
        FROM photo_replicas r
        WHERE r.photo_id = p.id
      ) replica_list ON TRUE
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
    return serverError('Photos:list', error, 'Unable to load photos right now');
  }
}
