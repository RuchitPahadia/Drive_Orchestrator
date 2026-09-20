import { query } from '../lib/db';
import { scanAccountImages, syncAccountPhotos } from '../lib/drive-scanner';

async function runPhase11Test() {
  console.log('--- 🧪 Phase 11 Smoke Test: Google Drive Library Sync ---\n');

  try {
    // 1. Fetch connected account
    const accRes = await query(
      `SELECT a.id, a.user_id, a.google_email, u.email as user_email 
       FROM accounts a 
       JOIN users u ON a.user_id = u.id 
       LIMIT 1`
    );

    if (accRes.rows.length === 0) {
      console.log('⚠️ No connected accounts found in database. Please connect an account first.');
      process.exit(0);
    }

    const testAccount = accRes.rows[0];
    console.log(`[Test] Selected account: ${testAccount.google_email} (ID: ${testAccount.id})`);
    console.log(`[Test] Owning user: ${testAccount.user_email} (ID: ${testAccount.user_id})`);

    // 2. Test scanAccountImages scanner
    console.log('\n--- Step 1: Testing scanAccountImages (max 20) ---');
    const scanned = await scanAccountImages(testAccount.id, 20);
    console.log(`[Scan] Successfully scanned Google Drive. Found ${scanned.length} image file(s):`);
    scanned.slice(0, 5).forEach((f, i) => {
      console.log(`   ${i + 1}. "${f.name}" (ID: ${f.id}, mime: ${f.mimeType}, size: ${f.size || 'unknown'} bytes)`);
    });
    if (scanned.length > 5) {
      console.log(`   ... and ${scanned.length - 5} more.`);
    }

    // 3. Test syncAccountPhotos ingestion & duplicate tracking
    console.log('\n--- Step 2: Testing syncAccountPhotos Ingestion ---');
    const syncResult1 = await syncAccountPhotos(testAccount.id, testAccount.user_id);
    console.log('[Sync Run 1] Result:', {
      account: syncResult1.accountEmail,
      totalDiscovered: syncResult1.totalDiscovered,
      syncedCount: syncResult1.syncedCount,
      skippedCount: syncResult1.skippedCount,
    });

    // 4. Test second pass to verify idempotent duplicate skipping
    console.log('\n--- Step 3: Testing Second Pass (Idempotency Check) ---');
    const syncResult2 = await syncAccountPhotos(testAccount.id, testAccount.user_id);
    console.log('[Sync Run 2] Result:', {
      account: syncResult2.accountEmail,
      totalDiscovered: syncResult2.totalDiscovered,
      syncedCount: syncResult2.syncedCount,
      skippedCount: syncResult2.skippedCount,
    });

    if (syncResult2.syncedCount !== 0) {
      throw new Error(`Expected 0 newly synced photos on second pass, but got ${syncResult2.syncedCount}`);
    }
    console.log('✅ Second pass correctly skipped all previously ingested photos (syncedCount = 0).');

    console.log('\n🎉 ALL PHASE 11 SMOKE TESTS PASSED SUCCESSFULLY! 🎉\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Phase 11 Test failed:', err);
    process.exit(1);
  }
}

runPhase11Test();
