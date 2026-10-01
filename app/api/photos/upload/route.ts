/**
 * @file app/api/photos/upload/route.ts
 * @description Resumable/batch photo upload endpoint: enforces SHA-256 deduplication,
 * balances uploads across eligible storage accounts via StorageRouter, uploads physical copies
 * in parallel to Google Drive, registers database records, and triggers background indexing.
 * @phase Phase 4: Storage Router & Upload & Phase 10: Deduplication & Replication
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { pickAccountsForUpload } from '@/lib/storage-router';
import { getDriveClient } from '@/lib/drive-client';
import { Readable } from 'stream';
import { queue } from '@/lib/queue';
import { indexPhoto } from '@/lib/indexer';
import { getSessionUser, unauthorized, serverError, tooManyRequests } from '@/lib/api-utils';
import { detectImageMime } from '@/lib/image-validation';
import { rateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

/** Vercel Serverless Function Max Duration (seconds) */
export const maxDuration = 60;

/** Maximum permissible photo upload size: 50 Megabytes */
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * POST: Handles photo upload from the browser client.
 * 
 * Pipeline:
 * 1. Validates multipart/form-data payload and file size limits (50 MB).
 * 2. Computes SHA-256 checksum over raw file bytes.
 * 3. Deduplication: skips upload if matching hash already exists for the user.
 * 4. Determines target Google Drive accounts based on replication factor & available quota.
 * 5. Concurrently uploads replica streams to Google Drive via Promise.all().
 * 6. Inserts logical photo row and physical replica records in PostgreSQL.
 * 7. Enqueues photo for asynchronous EXIF parsing and CLIP embedding generation.
 * 
 * @param request - Multipart form request containing 'file' entry.
 * @returns NextResponse with status ('uploaded' | 'duplicate'), metadata, and replica info.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate first — avoid parsing attacker-controlled bodies pre-auth
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const userId = user.id;

    // Rate limit as an abuse ceiling. Generous so normal batch uploads
    // (client concurrency = 2) are never affected: 200 uploads / minute / user.
    const rl = rateLimit(`upload:${userId}`, 200, 60_000);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    // 2. Parse form data to retrieve the file
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in the upload request' }, { status: 400 });
    }

    // 3. Enforce the 50MB file size limit
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        { error: `File size (${sizeMB} MB) exceeds the maximum allowed limit of 50 MB.` },
        { status: 400 }
      );
    }

    // 4. Read bytes and validate that the content is actually an image.
    //    @security The client-supplied MIME type is not trusted; the real type is
    //    derived from magic bytes so non-image/malicious payloads are rejected
    //    before they reach Drive and the sharp/exifr indexing pipeline.
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);

    const detectedMime = detectImageMime(fileBuffer);
    if (!detectedMime) {
      return NextResponse.json(
        { error: 'Unsupported file type. Only image files (JPEG, PNG, GIF, WebP, TIFF, BMP, HEIC/HEIF) are allowed.' },
        { status: 400 }
      );
    }

    // 5. Compute SHA-256 hash for instantaneous deduplication
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 5. Deduplication check: Has this exact file content already been uploaded by this user?
    const existingCheck = await query(
      `SELECT id, filename, thumbnail_url, size_bytes, created_at 
       FROM photos 
       WHERE user_id = $1 AND file_hash = $2 
       LIMIT 1`,
      [userId, fileHash]
    );

    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      console.log(`[Deduplication] File "${file.name}" is a duplicate of photo ${existing.id} ("${existing.filename}"). Skipping upload.`);
      return NextResponse.json(
        {
          status: 'duplicate',
          duplicate: true,
          message: `"${file.name}" already exists in your library as "${existing.filename}". Skipped duplicate upload.`,
          photo: existing,
        },
        { status: 200 }
      );
    }

    // 6. Select optimal connected Google Drive accounts based on user's replication factor
    let accountIds: string[];
    try {
      accountIds = await pickAccountsForUpload(userId, file.size);
    } catch (routeError) {
      const errorMsg = routeError instanceof Error ? routeError.message : 'Failed to determine target storage accounts';
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      );
    }

    // 7. Parallel replication: upload the file to target Google Drive accounts concurrently
    console.log(`Starting replication upload of "${file.name}" to ${accountIds.length} accounts...`);
    const uploadPromises = accountIds.map(async (accountId) => {
      try {
        const drive = await getDriveClient(accountId);
        // Create an independent readable stream from the memory buffer for each parallel upload stream
        const stream = Readable.from(fileBuffer);

        console.log(`Uploading "${file.name}" to Google Drive account ${accountId}...`);
        const driveResponse = await drive.files.create({
          requestBody: {
            name: file.name,
            mimeType: detectedMime,
          },
          media: {
            mimeType: detectedMime,
            body: stream,
          },
          fields: 'id, name, mimeType, size',
        });

        const driveFileId = driveResponse.data.id;
        if (!driveFileId) {
          throw new Error('Google Drive API returned empty file ID');
        }

        return { accountId, driveFileId };
      } catch (uploadError) {
        console.error(`Failed to upload to account ${accountId}:`, uploadError);
        return null;
      }
    });

    const uploadResults = (await Promise.all(uploadPromises)).filter(
      (res): res is { accountId: string; driveFileId: string } => res !== null
    );

    if (uploadResults.length === 0) {
      throw new Error('Upload failed: Could not upload the file to any of your connected Google Drive accounts.');
    }

    console.log(`Successfully uploaded "${file.name}" to ${uploadResults.length} accounts.`);

    // 8-9. Atomically record the logical photo row and its physical replica rows.
    //      Wrapped in a single transaction so a mid-loop failure can't leave the
    //      photo with a partial set of replica records.
    const photoRow = await withTransaction(async (tx) => {
      const photoResult = await tx(
        `INSERT INTO photos (user_id, filename, mime_type, size_bytes, file_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, filename, mime_type, size_bytes, file_hash, created_at`,
        [userId, file.name, detectedMime, file.size, fileHash]
      );
      const inserted = photoResult.rows[0];

      for (const replica of uploadResults) {
        await tx(
          `INSERT INTO photo_replicas (photo_id, account_id, drive_file_id)
           VALUES ($1, $2, $3)`,
          [inserted.id, replica.accountId, replica.driveFileId]
        );
      }

      return inserted;
    });

    const photoId = photoRow.id;

    // 10. Enqueue a background photo-indexing job or run inline if Redis is not configured
    const hasRedis = !!process.env.REDIS_URL;
    if (hasRedis) {
      try {
        console.log(`Enqueuing photo-indexing job for photo ID ${photoId}...`);
        await queue.add('photo-indexing', { photoId });
      } catch (queueError) {
        console.error(`Failed to enqueue indexing job for photo ${photoId}, falling back to inline indexing:`, queueError);
        // Fallback to inline background processing using after() for serverless safety
        after(async () => {
          try {
            await indexPhoto(photoId);
          } catch (err) {
            console.error(`[Inline Indexer Fail] Photo ${photoId}:`, err);
          }
        });
      }
    } else {
      console.log(`Redis not configured (REDIS_URL is empty). Executing indexer via after() for photo ID ${photoId}...`);
      // Run indexing inline in the background using after() (serverless-compatible, keeps lambda alive)
      after(async () => {
        try {
          await indexPhoto(photoId);
        } catch (err) {
          console.error(`[Inline Indexer Fail] Photo ${photoId}:`, err);
        }
      });
    }

    // Return the response with compatibility fields (mapping first replica's details)
    const compatibilityPhoto = {
      ...photoRow,
      account_id: uploadResults[0].accountId,
      drive_file_id: uploadResults[0].driveFileId,
      replicasCount: uploadResults.length,
    };

    return NextResponse.json({
      status: 'uploaded',
      duplicate: false,
      message: `Photo uploaded successfully (replicated to ${uploadResults.length} accounts)`,
      photo: compatibilityPhoto,
    });
  } catch (error) {
    return serverError('Upload', error, 'Unable to complete the upload right now');
  }
}
