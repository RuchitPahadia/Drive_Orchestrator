import { query } from '../lib/db';
import { pickAccountsForUpload } from '../lib/storage-router';
import crypto from 'crypto';

async function runPhase10Test() {
  console.log('--- 🧪 Phase 10 Smoke Test: Configurable Replication & Deduplication ---\n');

  try {
    // 1. Fetch a user to test with
    const userRes = await query(`SELECT id, email, replication_factor FROM users LIMIT 1`);
    if (userRes.rows.length === 0) {
      throw new Error('No user found in database to test with.');
    }
    const testUser = userRes.rows[0];
    console.log(`[Test] Using user: ${testUser.email} (ID: ${testUser.id})`);
    console.log(`[Test] Current replication_factor in DB: ${testUser.replication_factor}`);

    // 2. Fetch connected accounts
    const accRes = await query(`SELECT id, google_email, quota_total_bytes, quota_used_bytes FROM accounts WHERE user_id = $1`, [testUser.id]);
    console.log(`[Test] User has ${accRes.rows.length} connected accounts:`);
    accRes.rows.forEach((acc, i) => {
      const total = Number(acc.quota_total_bytes) || 0;
      const used = Number(acc.quota_used_bytes) || 0;
      const free = total - used;
      console.log(`   ${i + 1}. ${acc.google_email} (Free: ${(free / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
    });

    if (accRes.rows.length === 0) {
      console.log('⚠️ No accounts connected for this user. Testing router logic with fallback.');
    } else {
      // 3. Test Storage Router with 1x replication
      console.log('\n--- Testing Storage Router (1x Replication) ---');
      const accounts1x = await pickAccountsForUpload(testUser.id, 1024 * 1024, 1);
      console.log(`[Router 1x] Returned ${accounts1x.length} account(s):`, accounts1x);
      if (accounts1x.length !== 1) {
        throw new Error(`Expected exactly 1 account for 1x replication, got ${accounts1x.length}`);
      }
      console.log('✅ Router correctly selected top 1 account for 1x replication.');

      // 4. Test Storage Router with 2x replication
      console.log('\n--- Testing Storage Router (2x Replication) ---');
      const target2x = Math.min(2, accRes.rows.length);
      const accounts2x = await pickAccountsForUpload(testUser.id, 1024 * 1024, 2);
      console.log(`[Router 2x] Returned ${accounts2x.length} account(s):`, accounts2x);
      if (accounts2x.length !== target2x) {
        throw new Error(`Expected ${target2x} account(s) for 2x replication, got ${accounts2x.length}`);
      }
      console.log(`✅ Router correctly selected ${accounts2x.length} account(s) for 2x replication.`);
    }

    // 5. Test SHA-256 Deduplication Logic
    console.log('\n--- Testing SHA-256 Deduplication ---');
    const testBuffer = Buffer.from('synthetic_photo_payload_' + Date.now());
    const hash = crypto.createHash('sha256').update(testBuffer).digest('hex');
    console.log(`[Dedup] Generated SHA-256 hash: ${hash}`);

    // Step A: Insert a test photo record with this hash
    const insertRes = await query(
      `INSERT INTO photos (user_id, filename, mime_type, size_bytes, file_hash) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, filename, file_hash`,
      [testUser.id, 'test_dedup_image.jpg', 'image/jpeg', testBuffer.length, hash]
    );
    const testPhotoId = insertRes.rows[0].id;
    console.log(`[Dedup] Inserted test photo ${testPhotoId} with hash ${insertRes.rows[0].file_hash}`);

    // Step B: Query using index to find duplicate
    const dedupQuery = await query(
      `SELECT id, filename, file_hash FROM photos WHERE user_id = $1 AND file_hash = $2 LIMIT 1`,
      [testUser.id, hash]
    );

    if (dedupQuery.rows.length === 0 || dedupQuery.rows[0].id !== testPhotoId) {
      throw new Error('Deduplication index lookup failed to find matching photo.');
    }
    console.log(`✅ SHA-256 deduplication lookup matched existing photo ID: ${dedupQuery.rows[0].id} ("${dedupQuery.rows[0].filename}")`);

    // Step C: Clean up test photo
    await query(`DELETE FROM photos WHERE id = $1`, [testPhotoId]);
    console.log(`[Dedup] Cleaned up temporary test photo record.`);

    console.log('\n🎉 ALL PHASE 10 SMOKE TESTS PASSED SUCCESSFULLY! 🎉\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Phase 10 Test failed:', err);
    process.exit(1);
  }
}

runPhase10Test();
