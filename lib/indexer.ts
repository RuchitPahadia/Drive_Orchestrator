/**
 * @file lib/indexer.ts
 * @description Core photo indexing pipeline: downloads image streams from Google Drive,
 * extracts EXIF metadata (timestamp, GPS, camera model), generates optimized JPEG thumbnails,
 * computes 512-dimensional CLIP vision embeddings, and updates PostgreSQL records.
 * @phase Phase 5: Background Indexer Worker & Phase 8: CLIP Semantic Search
 */

import { query } from './db';
import { getDriveClient } from './drive-client';
import { Readable } from 'stream';
import exifr from 'exifr';
import sharp from 'sharp';
import { generateImageEmbedding, formatVectorForPostgres } from './embeddings';

/**
 * Helper to convert a Node.js Readable stream into a complete Buffer.
 * 
 * @param stream - Readable stream from the Google Drive file download request.
 * @returns Promise resolving to the concatenated Buffer.
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Core photo indexing logic. Downloads the file from Google Drive, parses EXIF metadata,
 * generates a 300x300 thumbnail, calculates CLIP vector embeddings, and updates the photos table.
 * 
 * @param photoId - The UUID of the photo in the PostgreSQL database.
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

    // Fetch the first available replica to get a valid drive_file_id and account_id to download from
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
      // exifr parses directly from memory buffers with zero temporary file I/O
      const exif = await exifr.parse(buffer);
      
      if (exif) {
        // Date Priority Chain: DateTimeOriginal (shutter press) > CreateDate (file creation) > ModifyDate
        const rawDate = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate;
        if (rawDate) {
          takenAt = rawDate instanceof Date ? rawDate : new Date(rawDate);
        }

        // Parse latitude/longitude if present in GPS IFD
        if (typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
          gpsLat = exif.latitude;
          gpsLng = exif.longitude;
        }

        // Parse camera manufacturer and model
        if (exif.Model) {
          let modelStr = String(exif.Model);
          // Append manufacturer name if it isn't already included in the camera model string
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

    // 5. Generate a resized Base64 thumbnail URL using sharp and compute CLIP embedding
    // Storing thumbnails as Base64 data URIs directly in the photos table eliminates the need
    // for a separate external object storage service (S3/Cloudinary) for gallery browsing.
    let thumbnailUrl: string | null = null;
    let embeddingVector: string | null = null;
    
    if (mimeType && mimeType.startsWith('image/')) {
      try {
        console.log(`[Indexer] Generating 300x300 JPEG thumbnail...`);
        const thumbnailBuffer = await sharp(buffer)
          .resize(300, 300, { fit: 'cover', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        
        thumbnailUrl = `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;

        // Generate CLIP 512-dim embedding from thumbnail buffer
        try {
          console.log(`[Indexer] Generating CLIP image embedding for "${filename}"...`);
          const rawVector = await generateImageEmbedding(thumbnailBuffer);
          embeddingVector = formatVectorForPostgres(rawVector);
          console.log(`[Indexer] Successfully generated 512-dim embedding for "${filename}".`);
        } catch (embedError) {
          const errorMsg = embedError instanceof Error ? embedError.message : String(embedError);
          console.warn(`[Indexer] [Warning] Failed to generate embedding for "${filename}": ${errorMsg}`);
        }
      } catch (sharpError) {
        const errorMsg = sharpError instanceof Error ? sharpError.message : String(sharpError);
        console.error(`[Indexer] Failed to generate thumbnail for "${filename}": ${errorMsg}`);
      }
    }

    // 6. Update database record
    // Keep prior derived data when a transient thumbnail/embedding failure occurs. A failed
    // embedding intentionally leaves indexed_at unchanged (NULL for new photos), allowing the
    // worker/admin retry path to discover and repair the photo instead of silently hiding it.
    console.log(`[Indexer] Saving metadata and embedding to photos table...`);
    await query(
      `UPDATE photos 
       SET taken_at = $1, 
           gps_lat = $2, 
           gps_lng = $3, 
           camera_model = $4, 
           thumbnail_url = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE thumbnail_url END, 
           embedding = CASE WHEN $6::text IS NOT NULL THEN $6::vector ELSE embedding END, 
           indexed_at = CASE WHEN $6::text IS NOT NULL THEN NOW() ELSE indexed_at END
       WHERE id = $7`,
      [takenAt, gpsLat, gpsLng, cameraModel, thumbnailUrl, embeddingVector, photoId]
    );

    console.log(`[Indexer] Finished indexing photo "${filename}" successfully.`);
  } catch (error) {
    console.error(`[Indexer] Failed to index photo ${photoId}:`, error);
    throw error;
  }
}
