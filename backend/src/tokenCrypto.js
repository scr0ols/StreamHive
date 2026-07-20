import crypto from 'node:crypto';

// Encrypts users.access_token/refresh_token at the application layer so a
// leaked DATABASE_URL or a DB-only breach doesn't also hand over live,
// usable Twitch tokens. The key lives in its own env var, never
// DATABASE_URL, so the two secrets don't leak together.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // standard GCM nonce size

function getKey() {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not set — refusing to start without a token encryption key.');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) for AES-256-GCM.');
  }
  return key;
}

// Throws at call time if the key is missing/malformed. Call once at startup
// so a misconfigured deploy fails fast instead of failing on first login.
export function assertEncryptionKeyConfigured() {
  getKey();
}

// Stored format: iv:authTag:ciphertext, each hex-encoded, so it round-trips
// through a plain TEXT column with no schema change.
export function encryptToken(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptToken(stored) {
  const key = getKey();
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Stored token is not in the expected iv:authTag:ciphertext format.');
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}
