/**
 * @file lib/image-validation.ts
 * @description Content-based image type detection via magic bytes. Used to validate
 * uploads instead of trusting the client-supplied MIME type, which can be spoofed.
 */

/** MIME types we accept for photo uploads. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  'image/bmp',
  'image/heic',
  'image/heif',
] as const;

/**
 * Detect an image MIME type from the leading bytes of a buffer. Returns the
 * detected MIME string, or `null` if the bytes don't match a known image format.
 */
export function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png';

  // GIF: "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';

  // WebP: "RIFF" .... "WEBP"
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) return 'image/webp';

  // TIFF: "II*\0" (little-endian) or "MM\0*" (big-endian)
  if (
    (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
    (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)
  ) return 'image/tiff';

  // BMP: "BM"
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp';

  // HEIC/HEIF: ISO-BMFF box "ftyp" at offset 4, with a HEIF-family brand
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand)) {
      return brand.startsWith('mif') || brand.startsWith('msf') ? 'image/heif' : 'image/heic';
    }
  }

  return null;
}
