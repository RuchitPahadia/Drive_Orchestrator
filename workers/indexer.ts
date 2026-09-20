import { Worker, Job } from 'bullmq';
import { connection, dlq } from '../lib/queue';
import { indexPhoto } from '../lib/indexer';

if (!process.env.REDIS_URL) {
  console.error('CRITICAL ERROR: REDIS_URL environment variable is not defined.');
  console.error('The background worker requires a Redis connection to listen for indexing jobs.');
  console.error('Please configure REDIS_URL in .env.local and retry.');
  process.exit(1);
}

console.log('Initializing background photo-indexing worker...');

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
    concurrency: 2, // Process up to 2 photos concurrently
  }
);

// Worker lifecycle hooks
worker.on('completed', (job) => {
  console.log(`[Job ${job.id}] Successfully finished indexing photo ${job.data.photoId}.`);
});

worker.on('failed', async (job, err) => {
  if (!job) return;
  const maxAttempts = job.opts.attempts || 3;
  console.warn(
    `[Job ${job.id}] Indexing attempt ${job.attemptsMade}/${maxAttempts} failed: ${err.message}`
  );

  // If all attempts exhausted, push to Dead-Letter Queue (DLQ)
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

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down worker...');
  await worker.close();
  console.log('Worker closed. Exiting process.');
  process.exit(0);
});
