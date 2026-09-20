import fs from 'fs';
import path from 'path';
import { defaultJobOptions, dlq } from '../lib/queue';

async function runPhase12Test() {
  console.log('--- 🧪 Phase 12 Smoke Test: Polish & Production Readiness ---\n');

  try {
    // 1. Verify Queue Resilience & DLQ Configuration
    console.log('--- Step 1: Verifying BullMQ Resilience & DLQ ---');
    if (!defaultJobOptions) {
      throw new Error('defaultJobOptions is not defined on queue.');
    }
    console.log(`[Queue] Default attempts configured: ${defaultJobOptions.attempts} (Expected: 3)`);
    if (defaultJobOptions.attempts !== 3) {
      throw new Error(`Expected 3 attempts, got ${defaultJobOptions.attempts}`);
    }

    const backoff = defaultJobOptions.backoff;
    console.log('[Queue] Backoff strategy:', backoff);
    if (!backoff || typeof backoff !== 'object' || backoff.type !== 'exponential' || backoff.delay !== 5000) {
      throw new Error('Expected exponential backoff with 5000ms initial delay.');
    }
    console.log('✅ BullMQ exponential retry policy verified.');

    if (!dlq || dlq.name !== 'photo-indexing-dlq') {
      throw new Error(`Expected DLQ named photo-indexing-dlq, got ${dlq?.name}`);
    }
    console.log(`✅ Dead-Letter Queue (DLQ) verified: "${dlq.name}".`);

    // 2. Verify Containerization Artifacts
    console.log('\n--- Step 2: Verifying Containerization Files ---');
    const rootDir = process.cwd();
    const dockerfile = fs.readFileSync(path.join(rootDir, 'Dockerfile'), 'utf-8');
    if (!dockerfile.includes('AS builder') || !dockerfile.includes('AS runner')) {
      throw new Error('Dockerfile does not use multi-stage build.');
    }
    console.log('✅ Multi-stage Dockerfile verified.');

    const workerDockerfile = fs.readFileSync(path.join(rootDir, 'Dockerfile.worker'), 'utf-8');
    if (!workerDockerfile.includes('workers/indexer.ts')) {
      throw new Error('Dockerfile.worker does not target indexer.');
    }
    console.log('✅ Standalone worker Dockerfile verified.');

    const compose = fs.readFileSync(path.join(rootDir, 'docker-compose.yml'), 'utf-8');
    if (!compose.includes('web:') || !compose.includes('worker:') || !compose.includes('redis:')) {
      throw new Error('docker-compose.yml is missing core services (web, worker, or redis).');
    }
    console.log('✅ docker-compose.yml bundles Web, Worker, and Redis services.');

    // 3. Verify CI Workflow
    console.log('\n--- Step 3: Verifying CI Workflow ---');
    const ciPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
    if (!fs.existsSync(ciPath)) {
      throw new Error('GitHub Actions CI workflow file missing.');
    }
    const ciYaml = fs.readFileSync(ciPath, 'utf-8');
    if (!ciYaml.includes('tsc --noEmit') || !ciYaml.includes('npm run lint')) {
      throw new Error('CI workflow does not test both tsc and lint.');
    }
    console.log('✅ GitHub Actions CI workflow verified.');

    // 4. Verify Next.js App Router Polish Files
    console.log('\n--- Step 4: Verifying Loading & Error Boundaries ---');
    const uxFiles = [
      'app/dashboard/loading.tsx',
      'app/browse/loading.tsx',
      'app/dashboard/error.tsx',
      'app/browse/error.tsx',
      'app/error.tsx',
    ];

    for (const f of uxFiles) {
      if (!fs.existsSync(path.join(rootDir, f))) {
        throw new Error(`Missing UX state file: ${f}`);
      }
      console.log(`   ✓ ${f} present`);
    }
    console.log('✅ All App Router loading skeletons and error boundaries verified.');

    console.log('\n🎉 ALL PHASE 12 VERIFICATIONS PASSED SUCCESSFULLY! 🎉\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Phase 12 Verification failed:', err);
    process.exit(1);
  }
}

runPhase12Test();
