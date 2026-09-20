/**
 * @file scripts/backfill-embeddings.ts
 * @description One-time migration script: generates CLIP ViT-B/32 512-dimensional vector embeddings
 * for existing photos in PostgreSQL that were uploaded before semantic search was introduced in Phase 8.
 * Decodes Base64 thumbnail data URIs into memory Buffers and invokes local ONNX inference.
 * @phase Phase 8: CLIP Semantic Search
 * 
 * Usage:
 * npx tsx scripts/backfill-embeddings.ts
 */

import { query } from '../lib/db';
import { generateImageEmbedding, formatVectorForPostgres } from '../lib/embeddings';

/**
 * Iterates through all photos where embedding IS NULL and thumbnail_url IS NOT NULL,
 * computes visual vector representations, and saves them to PostgreSQL.
 */
async function backfill() {
  console.log('[Backfill] Checking for photos missing embeddings...');
  const res = await query(
    `SELECT id, filename, thumbnail_url 
     FROM photos 
     WHERE embedding IS NULL AND thumbnail_url IS NOT NULL`
  );

  console.log(`[Backfill] Found ${res.rows.length} photo(s) to process.`);
  if (res.rows.length === 0) {
    console.log('[Backfill] All photos already have embeddings.');
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < res.rows.length; i++) {
    const photo = res.rows[i];
    console.log(`[Backfill] [${i + 1}/${res.rows.length}] Processing "${photo.filename}" (ID: ${photo.id})...`);

    try {
      // Decode Base64 data URL: data:image/jpeg;base64,...
      const base64Data = photo.thumbnail_url.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Generate 512-dimensional CLIP embedding vector
      const rawVector = await generateImageEmbedding(buffer);
      const vectorStr = formatVectorForPostgres(rawVector);

      // Save vector literal to PostgreSQL
      await query(
        `UPDATE photos 
         SET embedding = $1::vector, 
             indexed_at = COALESCE(indexed_at, NOW()) 
         WHERE id = $2`,
        [vectorStr, photo.id]
      );

      successCount++;
      console.log(`[Backfill] ✅ Saved 512-dim embedding for "${photo.filename}".`);
    } catch (err) {
      failCount++;
      console.error(`[Backfill] ❌ Failed to backfill "${photo.filename}":`, err);
    }
  }

  console.log(`[Backfill] Finished! Success: ${successCount}, Failed: ${failCount}.`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error('[Backfill] Fatal error:', err);
  process.exit(1);
});
