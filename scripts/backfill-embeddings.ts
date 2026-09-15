import { query } from '../lib/db';
import { generateImageEmbedding, formatVectorForPostgres } from '../lib/embeddings';

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

      // Generate embedding
      const rawVector = await generateImageEmbedding(buffer);
      const vectorStr = formatVectorForPostgres(rawVector);

      // Save to database
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
