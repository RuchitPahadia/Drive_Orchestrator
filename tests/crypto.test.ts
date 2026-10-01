/**
 * Unit tests for AES-256-GCM OAuth-token encryption helpers (lib/crypto.ts).
 * These guard the confidentiality + integrity of stored Google OAuth tokens.
 */
import { describe, it, expect, beforeAll } from 'vitest';

// crypto.ts reads TOKEN_ENCRYPTION_KEY lazily (at call time), so set it before importing.
beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-key-value-for-unit-tests';
});

const { encrypt, decrypt } = await import('@/lib/crypto');

describe('crypto', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const secret = 'ya29.a0ArefreshTokenSample-12345';
    const ciphertext = encrypt(secret);
    expect(ciphertext).not.toContain(secret);
    expect(decrypt(ciphertext)).toBe(secret);
  });

  it('produces a unique IV (different ciphertext) for identical input', () => {
    const a = encrypt('same-value');
    const b = encrypt('same-value');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it('emits the ivHex:tagHex:cipherHex format', () => {
    const parts = encrypt('x').split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // 12-byte IV -> 24 hex chars
    expect(parts[1]).toHaveLength(32); // 16-byte tag -> 32 hex chars
  });

  it('rejects a malformed token', () => {
    expect(() => decrypt('not-a-valid-token')).toThrow('Invalid encrypted token format');
  });

  it('rejects a tampered authentication tag', () => {
    const [iv, tag, data] = encrypt('tamper-me').split(':');
    const flipped = (tag[0] === 'a' ? 'b' : 'a') + tag.slice(1);
    expect(() => decrypt(`${iv}:${flipped}:${data}`)).toThrow();
  });

  it('handles unicode content', () => {
    const value = 'café — 📸 — toné';
    expect(decrypt(encrypt(value))).toBe(value);
  });
});
