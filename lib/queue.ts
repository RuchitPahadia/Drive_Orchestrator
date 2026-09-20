import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

declare global {
  var photoQueue: Queue | undefined;
  var deadLetterQueue: Queue | undefined;
  var redisConnection: Redis | undefined;
}

const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // 5s, 10s, 20s
  },
  removeOnComplete: {
    age: 3600, // Keep completed jobs for 1 hour
    count: 1000,
  },
  removeOnFail: {
    age: 86400 * 7, // Keep failed jobs for 7 days
  },
};

let connection: Redis | undefined = undefined;
let queue: Queue = {
  add: async () => {
    throw new Error('Redis Queue is disabled because REDIS_URL is not set.');
  },
} as unknown as Queue;

let dlq: Queue = {
  add: async () => {
    throw new Error('DLQ is disabled because REDIS_URL is not set.');
  },
} as unknown as Queue;

if (redisUrl) {
  if (process.env.NODE_ENV === 'production') {
    connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue('photo-indexing', { connection, defaultJobOptions });
    dlq = new Queue('photo-indexing-dlq', { connection });
  } else {
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
