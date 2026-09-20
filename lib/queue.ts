/**
 * @file lib/queue.ts
 * @description BullMQ distributed job queue configuration with exponential retry backoff,
 * Dead-Letter Queue (DLQ) failover, and graceful fallback when Redis is unconfigured.
 * Enables background photo indexing (EXIF parsing, thumbnail generation, CLIP vector embeddings).
 * @phase Phase 5: Background Indexer Worker & Phase 12: Production Polish
 */

import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

// Declare global handles to prevent multiple Redis connections during Next.js hot module reloading
declare global {
  var photoQueue: Queue | undefined;
  var deadLetterQueue: Queue | undefined;
  var redisConnection: Redis | undefined;
}

/**
 * Default resilience configuration for indexing queue jobs.
 * Implements exponential backoff retry semantics and retention rules.
 */
const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  attempts: 3, // Retry failed jobs up to 3 times before moving to DLQ
  backoff: {
    type: 'exponential',
    delay: 5000, // Exponential delays: attempt 1 = 5s, attempt 2 = 10s, attempt 3 = 20s
  },
  removeOnComplete: {
    age: 3600, // Retain metadata of completed jobs in Redis for 1 hour (audit trail)
    count: 1000, // Keep maximum 1,000 completed job records
  },
  removeOnFail: {
    age: 86400 * 7, // Retain failed job records for 7 days for post-mortem debugging
  },
};

let connection: Redis | undefined = undefined;

// Fallback mock queue stub used when REDIS_URL is absent (inlines work or logs a warning)
let queue: Queue = {
  add: async () => {
    throw new Error('Redis Queue is disabled because REDIS_URL is not set.');
  },
} as unknown as Queue;

// Fallback mock DLQ stub
let dlq: Queue = {
  add: async () => {
    throw new Error('DLQ is disabled because REDIS_URL is not set.');
  },
} as unknown as Queue;

if (redisUrl) {
  // === Branch 1: Production with Redis ===
  if (process.env.NODE_ENV === 'production') {
    connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue('photo-indexing', { connection, defaultJobOptions });
    dlq = new Queue('photo-indexing-dlq', { connection });
  } else {
    // === Branch 2: Development with Redis (Hot-Reload Singleton) ===
    if (!global.redisConnection) {
      global.redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    }
    connection = global.redisConnection;

    if (!global.photoQueue) {
      global.photoQueue = new Queue('photo-indexing', { connection, defaultJobOptions });
    }
    queue = global.photoQueue;

    if (!global.deadLetterQueue) {
      global.deadLetterQueue = new Queue('photo-indexing-dlq', { connection });
    }
    dlq = global.deadLetterQueue;
  }
} else {
  // === Branch 3: No Redis Configured (Fallback Mode) ===
  if (process.env.NODE_ENV === 'production') {
    console.warn('Warning: REDIS_URL environment variable is missing. Queue operates in fallback mock mode.');
  } else {
    if (!global.redisConnection) {
      console.warn('Warning: REDIS_URL is not set. BullMQ connection will run in lazy/local fallback mode.');
      global.redisConnection = new Redis({ maxRetriesPerRequest: null, lazyConnect: true });
    }
    connection = global.redisConnection;

    if (!global.photoQueue) {
      global.photoQueue = new Queue('photo-indexing', { connection, defaultJobOptions });
    }
    queue = global.photoQueue;

    if (!global.deadLetterQueue) {
      global.deadLetterQueue = new Queue('photo-indexing-dlq', { connection });
    }
    dlq = global.deadLetterQueue;
  }
}

export { queue, dlq, connection, defaultJobOptions };
export default queue;
