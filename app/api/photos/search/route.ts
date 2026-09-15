import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateTextEmbedding, formatVectorForPostgres } from '@/lib/embeddings';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q');
    const limitParam = searchParams.get('limit') || '30';
    const limit = Math.min(Math.max(parseInt(limitParam, 10) || 30, 1), 100);

    if (!q || !q.trim()) {
      return NextResponse.json({ error: 'Search query parameter "q" is required' }, { status: 400 });
    }

    // 1. Resolve user ID (currently default test user)
    const testUserEmail = 'testuser@example.com';
    const userResult = await query('SELECT id FROM users WHERE email = $1', [testUserEmail]);
    if (userResult.rows.length === 0) {
      return NextResponse.json({ photos: [], total: 0, query: q });
    }
    const userId = userResult.rows[0].id;

    // 2. Generate 512-dim embedding for the search query
    console.log(`[Semantic Search] Generating embedding for query: "${q.trim()}"...`);
    const queryVector = await generateTextEmbedding(q.trim());
    const vectorStr = formatVectorForPostgres(queryVector);

    // 3. Query photos by cosine similarity using pgvector HNSW index
    // Note: 1 - (embedding <=> query_vector) computes cosine similarity where 1.0 is identical
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
        ROUND((1 - (p.embedding <=> $1::vector))::numeric, 4) AS similarity,
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
      WHERE p.user_id = $2
        AND p.embedding IS NOT NULL
      ORDER BY p.embedding <=> $1::vector ASC
      LIMIT $3;
    `;

    const results = await query(sql, [vectorStr, userId, limit]);

    return NextResponse.json({
      query: q,
      total: results.rows.length,
      photos: results.rows,
    });
  } catch (error) {
    console.error('[Semantic Search] Error executing search:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to execute semantic search';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
