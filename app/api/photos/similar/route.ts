import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const photoId = searchParams.get('photoId');
    const limitParam = searchParams.get('limit') || '20';
    const limit = Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 50);

    if (!photoId) {
      return NextResponse.json({ error: 'Parameter "photoId" is required' }, { status: 400 });
    }

    // 1. Fetch source photo's embedding
    const sourceRes = await query(
      'SELECT id, filename, embedding FROM photos WHERE id = $1',
      [photoId]
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
        ROUND((1 - (p.embedding <=> $1))::numeric, 4) AS similarity,
        (
          SELECT r.account_id 
          FROM photo_replicas r 
          WHERE r.photo_id = p.id 
          LIMIT 1
        ) AS account_id,
        (
          SELECT r.drive_file_id 
          FROM photo_replicas r 
          WHERE r.photo_id = p.id 
          LIMIT 1
        ) AS drive_file_id,
        (
          SELECT ARRAY_AGG(r.account_id) 
          FROM photo_replicas r 
          WHERE r.photo_id = p.id
        ) AS replica_account_ids
      FROM photos p
      WHERE p.id != $2
        AND p.embedding IS NOT NULL
      ORDER BY p.embedding <=> $1 ASC
      LIMIT $3;
    `;

    const results = await query(sql, [sourcePhoto.embedding, photoId, limit]);

    return NextResponse.json({
      sourcePhotoId: photoId,
      sourceFilename: sourcePhoto.filename,
      total: results.rows.length,
      photos: results.rows,
    });
  } catch (error) {
    console.error('[Similar Photos] Error finding similar photos:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to find similar photos';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
