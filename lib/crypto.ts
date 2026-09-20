/**
 * @file lib/crypto.ts
 * @description AES-256-GCM encryption and decryption utilities for Google OAuth tokens.
 * Tokens stored in PostgreSQL are encrypted at rest with authentication tags ensuring
 * integrity and confidentiality.
 * @phase Phase 3: OAuth Connect + Callback
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard Initialization Vector (IV) length for GCM is 12 bytes
const TAG_LENGTH = 16; // Standard authentication tag length for GCM is 16 bytes (128 bits)

/**
 * Derives a consistent 32-byte (256-bit) encryption key from the environment variable.
 * 
 * @security Uses SHA-256 hashing over TOKEN_ENCRYPTION_KEY. This allows any arbitrary-length
 * passphrase from .env.local to be securely mapped to the exact 32-byte key size required
 * by aes-256-gcm without key truncation vulnerabilities.
 * @throws {Error} If TOKEN_ENCRYPTION_KEY is missing from environment variables.
 * @returns 32-byte Buffer representing the symmetric AES key.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not defined in your environment variables (.env.local)');
  }
  
  // Derive a 32-byte key using SHA-256 so that any length key is supported safely
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypts cleartext using AES-256-GCM authenticated symmetric encryption.
 * 
 * @param text - Raw UTF-8 plaintext string to encrypt (e.g. Google OAuth refresh token).
 * @returns Serialized ciphertext string formatted as `ivHex:tagHex:encryptedHex`.
 * The colon-delimited format allows reliable extraction of IV, auth tag, and payload during decryption.
 */
export function encrypt(text: string): string {
  // Generate a cryptographically secure unique IV for every encryption call
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Extract the GCM authentication tag for tamper detection
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_LENGTH) {
    throw new Error('Auth tag generation failed');
  }
  
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts ciphertext encrypted with encrypt().
 * Validates the GCM authentication tag to prevent ciphertext tampering and bit-flipping attacks.
 * 
 * @param encryptedText - Serialized ciphertext string formatted as `ivHex:tagHex:encryptedHex`.
 * @throws {Error} If token format is invalid or if authentication tag verification fails (tampering detected).
 * @returns Decrypted original UTF-8 plaintext string.
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  // Must set the expected auth tag before reading final decrypted content
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
