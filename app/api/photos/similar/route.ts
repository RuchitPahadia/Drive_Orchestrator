/**
 * @file app/api/photos/similar/route.ts
 * @description Visual similarity recommendation endpoint: identifies photos in the library
 * that are visually and semantically closest to a specified source photo using pgvector cosine distance.
 * @phase Phase 8: CLIP Semantic Search
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUser, unauthorized, serverError, parseLimit } from '@/lib/api-utils';

/** Vercel Serverless Function Max Duration (seconds) */
export const maxDuration = 60;

/**
 * GET: Finds visually similar photos for a given source photo.
 * 
 * Pipeline:
 * 1. Verifies that the source photo exists, belongs to the authenticated user, and has an embedding.
 * 2. Compares the 512-dimensional embedding against all other user photo embeddings using pgvector `<=>`.
 * 3. Excludes the source photo itself (`p.id != $2`).
 * 4. Orders results by ascending cosine distance (descending visual similarity).
 * 
 * @param request - Next.js HTTP request with query parameters:
 *   - `photoId`: UUID of the reference photo.
 *   - `limit`: Maximum similar photos to return (default: 20, max: 50).
 * @returns NextResponse with `{ sourcePhotoId, sourceFilename, total, photos }`.
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const userId = user.id;

    const searchParams = request.nextUrl.searchParams;
    const photoId = searchParams.get('photoId');
    const limit = parseLimit(searchParams.get('limit'), { def: DEFAULT_LIMIT, max: MAX_LIMIT });

    if (!photoId) {
      return NextResponse.json({ error: 'Parameter "photoId" is required' }, { status: 400 });
    }
    if (!UUID_PATTERN.test(photoId)) {
      return NextResponse.json({ error: 'Parameter "photoId" must be a valid UUID' }, { status: 400 });
    }
    if (limit === null) {
      return NextResponse.json(
        { error: `Parameter "limit" must be an integer between 1 and ${MAX_LIMIT}` },
        { status: 400 }
      );
    }

    // 1. Fetch source photo's embedding (scoped to authenticated user)
    const sourceRes = await query(
      'SELECT id, filename, embedding FROM photos WHERE id = $1 AND user_id = $2',
      [photoId, userId]
    );

    if (sourceRes.rows.length === 0) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const sourcePhoto = sourceRes.rows[0];
    if (!sourcePhoto.embedding) {
      return NextResponse.json(
        { error: 'Source photo has not been indexed with an embedding yet' },
        { status: 400 }
      );
    }

    // 2. Query nearest neighbor photos using pgvector cosine distance
    const sql = `
      SELECT 
        p.id,
        p.filename,
        p.mime_type,
        p.size_bytes,
        p.taken_at,
        p.gps_lat,
        p.gps_lng,
        p.camera_model,
        p.thumbnail_url,
        p.created_at,
        ROUND(GREATEST(0::numeric, LEAST(1::numeric, (1 - (p.embedding <=> $1::vector))::numeric)), 4) AS similarity,
        primary_replica.account_id,
        primary_replica.drive_file_id,
        replica_list.replica_account_ids
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
      WHERE p.id != $2
        AND p.user_id = $3
        AND p.embedding IS NOT NULL
      ORDER BY p.embedding <=> $1::vector ASC, p.taken_at DESC NULLS LAST, p.id ASC
      LIMIT $4;
    `;

    const results = await query(sql, [sourcePhoto.embedding, photoId, userId, limit]);

    return NextResponse.json({
      sourcePhotoId: photoId,
      sourceFilename: sourcePhoto.filename,
      total: results.rows.length,
      photos: results.rows,
    });
  } catch (error) {
    return serverError('Similar Photos', error, 'Unable to find similar photos right now');
  }
}
