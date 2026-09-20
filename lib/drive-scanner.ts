import { getDriveClient, refreshAccountQuota } from './drive-client';
import { query } from './db';
import { queue } from './queue';
import { indexPhoto } from './indexer';

export interface DriveDiscoveredImage {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  modifiedTime?: string;
}

export interface SyncAccountResult {
  accountId: string;
  accountEmail: string;
  totalDiscovered: number;
  syncedCount: number;
  skippedCount: number;
  newPhotoIds: string[];
}

/**
 * Scans a connected Google Drive account for image files.
 *
 * @param accountId UUID of the connected account in the database.
 * @param maxFiles Maximum number of files to scan per execution (default 200).
 */
export async function scanAccountImages(
  accountId: string,
  maxFiles = 200
): Promise<DriveDiscoveredImage[]> {
  const drive = await getDriveClient(accountId);
  const discovered: DriveDiscoveredImage[] = [];
  let pageToken: string | undefined = undefined;

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await drive.files.list({
      q: "mimeType contains 'image/' and trashed = false",
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)',
      pageSize: Math.min(100, maxFiles - discovered.length),
      pageToken: pageToken || undefined,
      spaces: 'drive',
    });

    const fileList = response.data.files || [];
    for (const f of fileList) {
      if (f.id && f.name) {
        discovered.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType || 'image/jpeg',
          size: f.size ? parseInt(f.size, 10) : undefined,
          createdTime: f.createdTime || undefined,
          modifiedTime: f.modifiedTime || undefined,
        });
      }
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken && discovered.length < maxFiles);

  console.log(`[DriveScanner] Found ${discovered.length} image files in account ${accountId}.`);
  return discovered;
}

/**
 * Ingests newly discovered images from Google Drive into the database.
 * Matches existing photo_replicas to skip already-imported photos.
 *
 * @param accountId UUID of the storage account.
 * @param userId UUID of the owning user.
 */
export async function syncAccountPhotos(
  accountId: string,
  userId: string
): Promise<SyncAccountResult> {
  // 1. Verify account ownership and fetch email
  const accRes = await query(
    `SELECT id, google_email FROM accounts WHERE id = $1 AND user_id = $2`,
    [accountId, userId]
  );

  if (accRes.rows.length === 0) {
    throw new Error('Account not found or access denied');
  }

  const accountEmail = accRes.rows[0].google_email;

  // 2. Discover images in the Drive account
  const discoveredFiles = await scanAccountImages(accountId);

  // 3. Fetch all drive_file_ids already tracked for this account
  const replicaRes = await query(
    `SELECT drive_file_id FROM photo_replicas WHERE account_id = $1`,
    [accountId]
  );

  const existingFileIds = new Set(replicaRes.rows.map(r => r.drive_file_id));

  // 4. Identify new files that haven't been ingested yet
  const newFiles = discoveredFiles.filter(file => !existingFileIds.has(file.id));
  const newPhotoIds: string[] = [];

  console.log(
    `[DriveSync] Account ${accountEmail}: Discovered ${discoveredFiles.length} images. ` +
    `${existingFileIds.size} already tracked. Ingesting ${newFiles.length} new photos...`
  );

  // 5. Ingest each new image into photos and photo_replicas
  const hasRedis = !!process.env.REDIS_URL;

  for (const file of newFiles) {
    try {
      // Record logical photo
      const createdAt = file.createdTime ? new Date(file.createdTime) : new Date();
      const photoRes = await query(
        `INSERT INTO photos (user_id, filename, mime_type, size_bytes, created_at) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id`,
        [
          userId,
          file.name,
          file.mimeType,
          file.size || 0,
          createdAt,
        ]
      );

      const photoId = photoRes.rows[0].id;
      newPhotoIds.push(photoId);

      // Record replica linking to this account
      await query(
        `INSERT INTO photo_replicas (photo_id, account_id, drive_file_id) 
         VALUES ($1, $2, $3)`,
        [photoId, accountId, file.id]
      );

      // Enqueue indexing job (EXIF metadata extraction, thumbnail, CLIP embedding)
      if (hasRedis) {
        queue.add('photo-indexing', { photoId }).catch(queueErr => {
          console.error(`[DriveSync] Failed to enqueue indexing for photo ${photoId}, running inline:`, queueErr);
          indexPhoto(photoId).catch(err => console.error(`[Inline Indexer Fail] Photo ${photoId}:`, err));
        });
      } else {
        // Run indexer inline asynchronously
        indexPhoto(photoId).catch(err => {
          console.error(`[Inline Indexer Fail] Photo ${photoId}:`, err);
        });
      }
    } catch (importErr) {
      console.error(`[DriveSync] Failed to ingest file "${file.name}" (${file.id}):`, importErr);
    }
  }

  // 6. Refresh storage quota from Google Drive
  try {
    await refreshAccountQuota(accountId);
  } catch (quotaErr) {
    console.error(`[DriveSync] Failed to refresh quota after sync for account ${accountId}:`, quotaErr);
  }

  return {
    accountId,
    accountEmail,
    totalDiscovered: discoveredFiles.length,
    syncedCount: newPhotoIds.length,
    skippedCount: discoveredFiles.length - newPhotoIds.length,
    newPhotoIds,
  };
}
