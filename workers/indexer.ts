/**
 * @file workers/indexer.ts
 * @description Dedicated BullMQ background indexing worker daemon.
 * Consumes 'photo-indexing' queue jobs to download photos from Google Drive, extract EXIF metadata,
 * generate thumbnails via Sharp, compute CLIP vision embeddings with ONNX, and escalate permanently
 * failed jobs to the Dead-Letter Queue (DLQ).
 * @phase Phase 5: Background Indexer Worker & Phase 12: Production Polish
 */

import { Worker, Job } from 'bullmq';
import { connection, dlq } from '../lib/queue';
import { indexPhoto } from '../lib/indexer';

// Validate that Redis connection parameters exist before starting daemon loop
if (!process.env.REDIS_URL) {
  console.error('CRITICAL ERROR: REDIS_URL environment variable is not defined.');
  console.error('The background worker requires a Redis connection to listen for indexing jobs.');
  console.error('Please configure REDIS_URL in .env.local and retry.');
  process.exit(1);
}

console.log('Initializing background photo-indexing worker...');

/**
 * BullMQ Worker Instance:
 * - Queue Name: 'photo-indexing'
 * - Concurrency: 2 (processes up to 2 image downloads/inferences in parallel to balance CPU/RAM limits)
 */
const worker = new Worker<{ photoId: string }>(
  'photo-indexing',
  async (job: Job<{ photoId: string }>) => {
    const { photoId } = job.data;
    console.log(`[Job ${job.id}] (Attempt ${job.attemptsMade + 1}) Processing photo ID: ${photoId}`);
    try {
      await indexPhoto(photoId);
    } catch (error) {
      console.error(`[Job ${job.id}] Attempt ${job.attemptsMade + 1} failed:`, error);
      throw error;
    }
  },
  {
    connection: connection!,
    concurrency: 2, // Concurrency of 2 prevents memory exhaustion during simultaneous ONNX CLIP inferences
  }
);

// Worker lifecycle hooks: Successful job completion
worker.on('completed', (job) => {
  console.log(`[Job ${job.id}] Successfully finished indexing photo ${job.data.photoId}.`);
});

// Worker lifecycle hooks: Failure and Dead-Letter Queue (DLQ) escalation
worker.on('failed', async (job, err) => {
  if (!job) return;
  const maxAttempts = job.opts.attempts || 3;
  console.warn(
    `[Job ${job.id}] Indexing attempt ${job.attemptsMade}/${maxAttempts} failed: ${err.message}`
  );

  // If all exponential retry attempts are exhausted, move job to Dead-Letter Queue (DLQ)
  if (job.attemptsMade >= maxAttempts) {
    console.error(
      `[Job ${job.id}] CRITICAL: Job exhausted all ${maxAttempts} retry attempts! Moving photo ${job.data.photoId} to Dead-Letter Queue (DLQ)...`
    );
    try {
      await dlq.add('dead-letter-job', {
        photoId: job.data.photoId,
        failedReason: err.message,
        failedAt: new Date().toISOString(),
        attemptsMade: job.attemptsMade,
      });
      console.log(`[Job ${job.id}] Successfully recorded in DLQ.`);
    } catch (dlqErr) {
      console.error(`[Job ${job.id}] Failed to enqueue to DLQ:`, dlqErr);
    }
  }
});

console.log('Background photo-indexing worker is active with retry backoff and DLQ enabled.');

/**
 * Graceful Shutdown Handling:
 * Listens for SIGTERM / SIGINT signals (e.g. from Docker container stop) and completes
 * active jobs before disconnecting cleanly from Redis.
 */
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down worker...');
  await worker.close();
  console.log('Worker closed. Exiting process.');
  process.exit(0);
});
