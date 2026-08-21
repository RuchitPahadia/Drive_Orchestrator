import { query } from './db';
import { getDriveClient } from './drive-client';
import { Readable } from 'stream';
import exifr from 'exifr';
import sharp from 'sharp';

/**
 * Helper to convert a Node.js Readable stream into a Buffer.
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Core photo indexing logic. Downloads the file, parses EXIF metadata,
 * generates a thumbnail, and updates the photos table record.
 * 
 * @param photoId The ID of the photo in the database.
 */
export async function indexPhoto(photoId: string): Promise<void> {
  console.log(`[Indexer] Starting indexing for photo ID: ${photoId}`);

  try {
    // 1. Load photo details from the database
    const photoResult = await query(
      'SELECT id, filename, mime_type FROM photos WHERE id = $1',
      [photoId]
    );

    if (photoResult.rows.length === 0) {
      console.error(`[Indexer] Photo ${photoId} not found in database. Skipping.`);
      return;
    }

    const { filename, mime_type: mimeType } = photoResult.rows[0];

    // Fetch the replicas to get a valid drive_file_id and account_id to download from
    const replicasResult = await query(
      'SELECT account_id, drive_file_id FROM photo_replicas WHERE photo_id = $1 LIMIT 1',
      [photoId]
    );

    if (replicasResult.rows.length === 0) {
      console.error(`[Indexer] No physical replicas found in database for photo ${photoId}. Skipping.`);
      return;
    }

    const { account_id: accountId, drive_file_id: driveFileId } = replicasResult.rows[0];

    // 2. Obtain the Google Drive API client
    const drive = await getDriveClient(accountId);

    // 3. Download the file stream from Google Drive
    console.log(`[Indexer] Downloading "${filename}" (${driveFileId}) from Google Drive account ${accountId}...`);
    const driveResponse = await drive.files.get(
      { fileId: driveFileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const stream = driveResponse.data as Readable;
    const buffer = await streamToBuffer(stream);
    console.log(`[Indexer] Successfully downloaded ${buffer.length} bytes.`);

    // 4. Extract EXIF metadata (taken date, GPS, camera model) using exifr
    let takenAt: Date | null = null;
    let gpsLat: number | null = null;
    let gpsLng: number | null = null;
    let cameraModel: string | null = null;

    try {
      // exifr is very efficient and parses directly from memory buffers
      const exif = await exifr.parse(buffer);
      
      if (exif) {
        // Check standard EXIF date properties
        const rawDate = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate;
        if (rawDate) {
          takenAt = rawDate instanceof Date ? rawDate : new Date(rawDate);
        }

        // Parse latitude/longitude if present
        if (typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
          gpsLat = exif.latitude;
          gpsLng = exif.longitude;
        }

        // Parse camera details
        if (exif.Model) {
          let modelStr = String(exif.Model);
          // Append manufacturer name if it makes sense and isn't already in the model string
          if (exif.Make && !modelStr.toLowerCase().includes(String(exif.Make).toLowerCase())) {
            modelStr = `${exif.Make} ${modelStr}`;
          }
          cameraModel = modelStr;
        }
      }
    } catch (exifError) {
      const errorMsg = exifError instanceof Error ? exifError.message : String(exifError);
      console.warn(`[Indexer] [Warning] Failed to parse EXIF metadata for "${filename}": ${errorMsg}`);
    }

    // 5. Generate a resized Base64 thumbnail URL using sharp
    let thumbnailUrl: string | null = null;
    
    if (mimeType && mimeType.startsWith('image/')) {
      try {
        console.log(`[Indexer] Generating 300x300 JPEG thumbnail...`);
        const thumbnailBuffer = await sharp(buffer)
          .resize(300, 300, { fit: 'cover', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        
        thumbnailUrl = `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
      } catch (sharpError) {
        const errorMsg = sharpError instanceof Error ? sharpError.message : String(sharpError);
        console.error(`[Indexer] Failed to generate thumbnail for "${filename}": ${errorMsg}`);
      }
    }

    // 6. Update database record
    console.log(`[Indexer] Saving metadata to photos table...`);
    await query(
      `UPDATE photos 
       SET taken_at = $1, 
           gps_lat = $2, 
           gps_lng = $3, 
           camera_model = $4, 
           thumbnail_url = $5, 
           indexed_at = NOW() 
       WHERE id = $6`,
      [takenAt, gpsLat, gpsLng, cameraModel, thumbnailUrl, photoId]
    );

    console.log(`[Indexer] Finished indexing photo "${filename}" successfully.`);
  } catch (error) {
    console.error(`[Indexer] Failed to index photo ${photoId}:`, error);
    throw error;
  }
}
