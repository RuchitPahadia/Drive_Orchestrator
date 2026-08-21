import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { pickAccountsForUpload } from '@/lib/storage-router';
import { getDriveClient } from '@/lib/drive-client';
import { Readable } from 'stream';
import { queue } from '@/lib/queue';
import { indexPhoto } from '@/lib/indexer';

export async function POST(request: NextRequest) {
  try {
    // 1. Parse form data to retrieve the file
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in the upload request' }, { status: 400 });
    }

    // 2. Enforce the 50MB file size limit
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        { error: `File size (${sizeMB} MB) exceeds the maximum allowed limit of 50 MB.` },
        { status: 400 }
      );
    }

    // 3. Resolve the hardcoded test user ID
    const testUserEmail = 'testuser@example.com';
    const userResult = await query('SELECT id FROM users WHERE email = $1', [testUserEmail]);
    
    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Test user not found in the database. Please connect a Google Drive account in the dashboard first to initialize the default user.' },
        { status: 400 }
      );
    }
    const userId = userResult.rows[0].id;

    // 4. Select all eligible connected Google Drive accounts for the upload
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

    // 5. Upload the file to all eligible accounts in parallel
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);

    console.log(`Starting replication upload of "${file.name}" to ${accountIds.length} accounts...`);
    const uploadPromises = accountIds.map(async (accountId) => {
      try {
        const drive = await getDriveClient(accountId);
        // Create a new stream from the buffer for each upload
        const stream = Readable.from(fileBuffer);

        console.log(`Uploading "${file.name}" to Google Drive account ${accountId}...`);
        const driveResponse = await drive.files.create({
          requestBody: {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
          },
          media: {
            mimeType: file.type || 'application/octet-stream',
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

    // 6. Record metadata in the photos database table (logical photo)
    const photoResult = await query(
      `INSERT INTO photos (user_id, filename, mime_type, size_bytes) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, user_id, filename, mime_type, size_bytes, created_at`,
      [
        userId,
        file.name,
        file.type || 'application/octet-stream',
        file.size,
      ]
    );

    const photoId = photoResult.rows[0].id;

    // 7. Record each physical copy in the photo_replicas table
    for (const replica of uploadResults) {
      await query(
        `INSERT INTO photo_replicas (photo_id, account_id, drive_file_id) 
         VALUES ($1, $2, $3)`,
        [photoId, replica.accountId, replica.driveFileId]
      );
    }

    // 8. Enqueue a background photo-indexing job or run inline if Redis is not configured
    const hasRedis = !!process.env.REDIS_URL;
    if (hasRedis) {
      try {
        console.log(`Enqueuing photo-indexing job for photo ID ${photoId}...`);
        await queue.add('photo-indexing', { photoId });
      } catch (queueError) {
        console.error(`Failed to enqueue indexing job for photo ${photoId}, falling back to inline indexing:`, queueError);
        // Fallback to inline background processing if Redis connection fails
        indexPhoto(photoId).catch(err => {
          console.error(`[Inline Indexer Fail] Photo ${photoId}:`, err);
        });
      }
    } else {
      console.log(`Redis not configured (REDIS_URL is empty). Executing indexer inline for photo ID ${photoId}...`);
      // Run indexing inline in the background (non-blocking for HTTP response)
      indexPhoto(photoId).catch(err => {
        console.error(`[Inline Indexer Fail] Photo ${photoId}:`, err);
      });
    }

    // Return the response with compatibility fields (mapping first replica's details)
    const compatibilityPhoto = {
      ...photoResult.rows[0],
      account_id: uploadResults[0].accountId,
      drive_file_id: uploadResults[0].driveFileId,
      replicasCount: uploadResults.length,
    };

    return NextResponse.json({
      message: `Photo uploaded successfully (replicated to ${uploadResults.length} accounts)`,
      photo: compatibilityPhoto,
    });
  } catch (error) {
    console.error('Error handling upload request:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred during upload';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

