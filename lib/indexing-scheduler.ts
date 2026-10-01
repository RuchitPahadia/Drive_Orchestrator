/**
 * @file lib/indexing-scheduler.ts
 * @description Single place that decides how a photo gets indexed. When Redis/BullMQ
 * is configured, indexing is enqueued as a durable background job. When it is not,
 * the caller is told to run indexing itself — in a request handler that should be
 * done via `after()` (serverless-safe); in a long-lived worker it can be awaited.
 *
 * This replaces the previous pattern of detached `indexPhoto().catch()` calls inside
 * the Drive scanner, which could be killed when a serverless response returned.
 */

import { queue } from './queue';

/**
 * Enqueue a durable indexing job if Redis is configured.
 *
 * @returns `true` if the job was enqueued (nothing more to do), `false` if the
 * caller must run `indexPhoto(photoId)` itself.
 */
export async function enqueueIndexing(photoId: string): Promise<boolean> {
  if (!process.env.REDIS_URL) return false;
  try {
    await queue.add('photo-indexing', { photoId });
    return true;
  } catch (err) {
    console.error(`[Indexing] Failed to enqueue indexing job for photo ${photoId}:`, err);
    return false;
  }
}
