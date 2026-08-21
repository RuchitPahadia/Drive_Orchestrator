import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

declare global {
  var photoQueue: Queue | undefined;
  var redisConnection: Redis | undefined;
}

let connection: Redis | undefined = undefined;
let queue: Queue = {
  add: async () => {
    throw new Error('Redis Queue is disabled because REDIS_URL is not set.');
  }
} as unknown as Queue;

if (redisUrl) {
  if (process.env.NODE_ENV === 'production') {
    connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue('photo-indexing', { connection });
  } else {
    if (!global.redisConnection) {
      global.redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    }
    connection = global.redisConnection;

    if (!global.photoQueue) {
      global.photoQueue = new Queue('photo-indexing', { connection });
    }
    queue = global.photoQueue;
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
      global.photoQueue = new Queue('photo-indexing', { connection });
    }
    queue = global.photoQueue;
  }
}

export { queue, connection };
export default queue;
