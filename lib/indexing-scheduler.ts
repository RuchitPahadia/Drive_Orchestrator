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
import { indexPhoto } from './indexer';

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

/**
 * Index a batch of photos: enqueue each via the queue when Redis is configured,
 * otherwise run indexing inline. This is awaited — a request handler should wrap the
 * call in `after()` (serverless-safe); a long-lived worker can await it directly.
 */
export async function runIndexing(photoIds: string[]): Promise<void> {
  for (const photoId of photoIds) {
    const queued = await enqueueIndexing(photoId);
    if (!queued) {
      try {
        await indexPhoto(photoId);
      } catch (err) {
        console.error(`[Indexing] Inline indexing failed for photo ${photoId}:`, err);
      }
    }
  }
}
