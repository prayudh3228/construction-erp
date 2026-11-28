import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
} from 'node:crypto';

/**
 * Encrypts small secrets at rest (authenticator secrets) with AES-256-GCM, and makes keyed hashes
 * (recovery codes). The master key comes from AUTH_ENCRYPTION_KEY, never from code; separate
 * subkeys for encryption and hashing are derived from it with HKDF, so one use can never weaken
 * the other. Stored values carry a version prefix ("v1:") so the key can be rotated later.
 */
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class SecretBox {
  private readonly encKey: Buffer;
  private readonly macKey: Buffer;

  constructor(base64Key: string) {
    const master = Buffer.from(base64Key, 'base64');
    if (master.length !== 32) {
      throw new Error('AUTH_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    }
    const derive = (info: string) =>
      Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), info, 32));
    this.encKey = derive('erp/totp-secret-encryption/v1');
    this.macKey = derive('erp/recovery-code-hmac/v1');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.encKey, iv, { authTagLength: TAG_LENGTH });
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${Buffer.concat([iv, tag, data]).toString('base64')}`;
  }

  /** Throws if the value was tampered with, truncated, or encrypted with another key. */
  decrypt(stored: string): string {
    if (!stored.startsWith('v1:')) throw new Error('Unknown secret format');
    const raw = Buffer.from(stored.slice(3), 'base64');
    // A full IV and a full 16-byte tag, never a shortened tag (which would weaken the check).
    if (raw.length < IV_LENGTH + TAG_LENGTH + 1) throw new Error('Secret is too short');
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const data = raw.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', this.encKey, iv, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  /**
   * Keyed hash for high-entropy one-time codes (recovery codes). A fast HMAC is right here: the
   * codes are random (about 50 bits), and without the key the stored hashes cannot be tested.
   */
  hash(value: string): string {
    return createHmac('sha256', this.macKey).update(value).digest('hex');
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
