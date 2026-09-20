/**
 * @file app/api/photos/search/route.ts
 * @description Natural language semantic search endpoint powered by CLIP embeddings and
 * Supabase pgvector. Translates text search queries into 512-dimensional vectors and performs
 * approximate nearest-neighbor (ANN) cosine distance queries against stored photo embeddings.
 * @phase Phase 8: CLIP Semantic Search
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { generateTextEmbedding, formatVectorForPostgres } from '@/lib/embeddings';

/**
 * GET: Executes semantic vector similarity search for a text query.
 * 
 * Mathematical Model:
 * 1. Query text is encoded using CLIP ViT-B/32 text projection into a normalized 512-dim vector.
 * 2. PostgreSQL compares vectors using the cosine distance operator `<=>`:
 *    `cosine_distance = 1 - cosine_similarity`
 * 3. Similarity score is computed as `ROUND((1 - (p.embedding <=> $1::vector))::numeric, 4)`.
 *    A score of 1.0 represents an exact visual match, while 0.0 represents orthogonal vectors.
 * 4. The query leverages the `photos_embedding_hnsw_idx` Hierarchical Navigable Small World (HNSW)
 *    index for sub-millisecond retrieval across thousands of photos.
 * 
 * @param request - Next.js HTTP request with query parameters:
 *   - `q`: Natural language search query (e.g. "red car", "beach sunset").
 *   - `limit`: Maximum photos to return (default: 30, max: 100).
 * @returns NextResponse with `{ query, total, photos }`.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q');
    const limitParam = searchParams.get('limit') || '30';
    const limit = Math.min(Math.max(parseInt(limitParam, 10) || 30, 1), 100);

    if (!q || !q.trim()) {
      return NextResponse.json({ error: 'Search query parameter "q" is required' }, { status: 400 });
    }

    // 2. Generate 512-dim embedding for the search query using local ONNX model
    console.log(`[Semantic Search] Generating embedding for query: "${q.trim()}"...`);
    const queryVector = await generateTextEmbedding(q.trim());
    const vectorStr = formatVectorForPostgres(queryVector);

    // 3. Query photos by cosine similarity using the pgvector HNSW index
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
