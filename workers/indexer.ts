import { Worker, Job } from 'bullmq';
import { connection } from '../lib/queue';
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
    console.log(`[Job ${job.id}] Processing photo ID: ${photoId}`);
    try {
      await indexPhoto(photoId);
    } catch (error) {
      console.error(`[Job ${job.id}] Job failed with error:`, error);
      throw error;
    }
  },
  { connection: connection! }
);

console.log('Background photo-indexing worker is active and listening for jobs on Redis.');

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down worker...');
  await worker.close();
  console.log('Worker closed. Exiting process.');
  process.exit(0);
});

