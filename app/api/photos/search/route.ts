/**
 * @file app/api/photos/search/route.ts
 * @description Natural language semantic search endpoint powered by CLIP embeddings and
 * Supabase pgvector. Translates text search queries into 512-dimensional vectors and performs
 * approximate nearest-neighbor (ANN) cosine distance queries against stored photo embeddings.
 * @phase Phase 8: CLIP Semantic Search
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateTextEmbedding, formatVectorForPostgres } from '@/lib/embeddings';
import { getSessionUser, unauthorized, serverError, parseLimit, MAX_PAGE_LIMIT } from '@/lib/api-utils';

/** Vercel Serverless Function Max Duration (seconds) */
export const maxDuration = 60;

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
const MAX_QUERY_LENGTH = 200;

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const userId = user.id;

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = searchParams.get('q');
    const limit = parseLimit(searchParams.get('limit'));

    if (limit === null) {
      return NextResponse.json(
        { error: `Parameter "limit" must be an integer between 1 and ${MAX_PAGE_LIMIT}` },
        { status: 400 }
      );
    }

    if (!rawQuery || !rawQuery.trim()) {
      return NextResponse.json({ error: 'Search query parameter "q" is required' }, { status: 400 });
    }

    // Collapse repeated whitespace so equivalent searches use the same model input.
    const searchQuery = rawQuery.trim().replace(/\s+/g, ' ');
    if (searchQuery.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Search query must be ${MAX_QUERY_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    // 2. Generate 512-dim embedding for the search query using local ONNX model
    console.log(`[Semantic Search] Generating embedding for query: "${searchQuery}"...`);
    const queryVector = await generateTextEmbedding(searchQuery);
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
      WHERE p.user_id = $2
        AND p.embedding IS NOT NULL
      ORDER BY p.embedding <=> $1::vector ASC, p.taken_at DESC NULLS LAST, p.id ASC
      LIMIT $3;
    `;

    const results = await query(sql, [vectorStr, userId, limit]);

    return NextResponse.json({
      query: searchQuery,
      total: results.rows.length,
      photos: results.rows,
    });
  } catch (error) {
    return serverError('Semantic Search', error, 'Unable to complete photo search right now');
  }
}
