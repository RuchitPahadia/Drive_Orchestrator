import sharp from 'sharp';
import { generateTextEmbedding, generateImageEmbedding, formatVectorForPostgres } from '../lib/embeddings';
import { query } from '../lib/db';

async function run() {
  console.log('--- Phase 8: CLIP Embeddings & pgvector Smoke Test ---');

  // 1. Generate text embeddings
  console.log('1. Generating text embeddings for queries...');
  const text1 = 'a golden retriever playing in a park';
  const text2 = 'sunset over the ocean with orange clouds';
  
  const emb1 = await generateTextEmbedding(text1);
  const emb2 = await generateTextEmbedding(text2);

  console.log(`- Text 1 embedding length: ${emb1.length}`);
  console.log(`- Text 2 embedding length: ${emb2.length}`);

  // Check L2 norm
  const norm1 = Math.sqrt(emb1.reduce((sum, v) => sum + v * v, 0));
  const norm2 = Math.sqrt(emb2.reduce((sum, v) => sum + v * v, 0));
  console.log(`- Text 1 L2 norm: ${norm1.toFixed(4)} (expected ~1.0)`);
  console.log(`- Text 2 L2 norm: ${norm2.toFixed(4)} (expected ~1.0)`);

  // 2. Generate image embedding from a synthetic orange sunset image
  console.log('\n2. Generating image embedding from 224x224 synthetic JPEG...');
  const testImageBuffer = await sharp({
    create: {
      width: 224,
      height: 224,
      channels: 3,
      background: { r: 255, g: 140, b: 0 } // orange
    }
  }).jpeg().toBuffer();

  const imgEmb = await generateImageEmbedding(testImageBuffer);
  console.log(`- Image embedding length: ${imgEmb.length}`);
  const imgNorm = Math.sqrt(imgEmb.reduce((sum, v) => sum + v * v, 0));
  console.log(`- Image L2 norm: ${imgNorm.toFixed(4)} (expected ~1.0)`);

  // 3. Test pgvector similarity via PostgreSQL connection
  console.log('\n3. Querying pgvector via Supabase...');
  const vec1Str = formatVectorForPostgres(emb1);
  const vec2Str = formatVectorForPostgres(emb2);
  const imgVecStr = formatVectorForPostgres(imgEmb);

  const res = await query(
    `SELECT 
      ROUND((1 - ($1::vector <=> $2::vector))::numeric, 4) AS text_diff_sim,
      ROUND((1 - ($2::vector <=> $3::vector))::numeric, 4) AS sunset_text_orange_img_sim,
      ROUND((1 - ($1::vector <=> $3::vector))::numeric, 4) AS dog_text_orange_img_sim`,
    [vec1Str, vec2Str, imgVecStr]
  );

  console.log('Cosine Similarities from pgvector:');
  console.log(`- Dog query vs Sunset query: ${res.rows[0].text_diff_sim}`);
  console.log(`- Sunset query vs Orange image: ${res.rows[0].sunset_text_orange_img_sim}`);
  console.log(`- Dog query vs Orange image: ${res.rows[0].dog_text_orange_img_sim}`);
  console.log('\n[SUCCESS] Phase 8 End-to-End Test PASSED!');
  process.exit(0);
}

run().catch(err => {
  console.error('[FAILED] Test error:', err);
  process.exit(1);
});
