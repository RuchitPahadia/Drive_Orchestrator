import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

declare global {
  var photoQueue: Queue | undefined;
  var redisConnection: Redis | undefined;
}

let connection: Redis;
let queue: Queue;

if (process.env.NODE_ENV === 'production') {
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is missing.');
  }
  // BullMQ requires maxRetriesPerRequest to be null on the connection it uses
  connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  queue = new Queue('photo-indexing', { connection });
} else {
  if (!global.redisConnection) {
    if (!redisUrl) {
      console.warn('Warning: REDIS_URL is not set. BullMQ connection will run in lazy/local fallback mode.');
      // Initialize with lazyConnect so it doesn't try to connect immediately during build or linting
      global.redisConnection = new Redis({ maxRetriesPerRequest: null, lazyConnect: true });
    } else {
      global.redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    }
  }
  connection = global.redisConnection;

  if (!global.photoQueue) {
    global.photoQueue = new Queue('photo-indexing', { connection });
  }
  queue = global.photoQueue;
}

export { queue, connection };
export default queue;
