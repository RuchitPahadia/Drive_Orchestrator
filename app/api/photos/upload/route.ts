import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { pickAccountForUpload } from '@/lib/storage-router';
import { getDriveClient } from '@/lib/drive-client';
import { Readable } from 'stream';

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

    // 4. Select the best connected Google Drive account for the upload
    let accountId: string;
    try {
      accountId = await pickAccountForUpload(userId, file.size);
    } catch (routeError) {
      const errorMsg = routeError instanceof Error ? routeError.message : 'Failed to determine target storage account';
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      );
    }

    // 5. Get the Google Drive client and initiate the upload
    const drive = await getDriveClient(accountId);
    
    // Convert the File (Blob) content to a node Readable stream for the googleapis client
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);

    console.log(`Uploading file "${file.name}" (${file.size} bytes) to Google Drive account ${accountId}...`);
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
      throw new Error('Google Drive API completed upload but failed to return a file ID');
    }

    // 6. Record metadata in the photos database table
    const photoResult = await query(
      `INSERT INTO photos (user_id, account_id, drive_file_id, filename, mime_type, size_bytes) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, user_id, account_id, drive_file_id, filename, mime_type, size_bytes, created_at`,
      [
        userId,
        accountId,
        driveFileId,
        file.name,
        file.type || 'application/octet-stream',
        file.size,
      ]
    );

    return NextResponse.json({
      message: 'Photo uploaded successfully',
      photo: photoResult.rows[0],
    });
  } catch (error) {
    console.error('Error handling upload request:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred during upload';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
