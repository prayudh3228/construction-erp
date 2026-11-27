import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt } from 'node:crypto';

/**
 * Encrypts small secrets at rest (authenticator secrets) with AES-256-GCM, and makes keyed hashes
 * (recovery codes). The key comes from AUTH_ENCRYPTION_KEY, never from code. Stored values carry
 * a version prefix ("v1:") so the key can be rotated later.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, 'base64');
    if (key.length !== 32) throw new Error('AUTH_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    this.key = key;
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${Buffer.concat([iv, tag, data]).toString('base64')}`;
  }

  /** Throws if the value was tampered with or encrypted with another key. */
  decrypt(stored: string): string {
    if (!stored.startsWith('v1:')) throw new Error('Unknown secret format');
    const raw = Buffer.from(stored.slice(3), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  /**
   * Keyed hash for high-entropy one-time codes (recovery codes). A fast HMAC is right here: the
   * codes are random (about 50 bits), and without the key the stored hashes cannot be tested.
   */
  hash(value: string): string {
    return createHmac('sha256', this.key).update(`recovery:${value}`).digest('hex');
  }
}

/** Recovery code alphabet without look-alikes (no 0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Ten codes like "K7QXM-2PDHA": 10 characters from 31, about 49.5 bits each. */
export function newRecoveryCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    // randomInt is unbiased (no modulo skew towards some letters).
    const chars = Array.from(
      { length: 10 },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
    ).join('');
    codes.add(`${chars.slice(0, 5)}-${chars.slice(5)}`);
  }
  return [...codes];
}

/** People type codes in any case, with or without the dash. */
export function normaliseRecoveryCode(input: string): string {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length === 10 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
}
