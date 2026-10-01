/**
 * Unit tests for magic-byte image type detection (lib/image-validation.ts),
 * which backs the upload content-type validation.
 */
import { describe, it, expect } from 'vitest';
import { detectImageMime } from '@/lib/image-validation';

/** Build a 16-byte buffer starting with the given byte values. */
function bytes(...head: number[]): Buffer {
  const b = Buffer.alloc(16, 0);
  head.forEach((v, i) => (b[i] = v));
  return b;
}

describe('detectImageMime', () => {
  it('detects JPEG', () => {
    expect(detectImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  });

  it('detects PNG', () => {
    expect(detectImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
  });

  it('detects GIF', () => {
    expect(detectImageMime(bytes(0x47, 0x49, 0x46, 0x38))).toBe('image/gif');
  });

  it('detects WebP', () => {
    const b = Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'ascii');
    expect(detectImageMime(b)).toBe('image/webp');
  });

  it('detects BMP', () => {
    expect(detectImageMime(bytes(0x42, 0x4d))).toBe('image/bmp');
  });

  it('detects HEIC via ftyp box', () => {
    const b = Buffer.from('\0\0\0\x18ftypheic', 'ascii');
    expect(detectImageMime(b)).toBe('image/heic');
  });

  it('rejects a plain-text / non-image payload', () => {
    expect(detectImageMime(Buffer.from('<html>not an image</html>', 'utf8'))).toBeNull();
  });

  it('rejects a buffer that is too short to classify', () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});
