import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing with scrypt (built into Node, no native add-on). The stored string carries
 * its own parameters, "scrypt$<log2N>$<r>$<p>$<salt>$<hash>", so the cost can be raised later
 * and old hashes still verify (and are upgraded at the next successful sign-in).
 */
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;

function scrypt(password: string, salt: Buffer, log2N: number, r: number, p: number) {
  const N = 2 ** log2N;
  // scrypt needs 128 * N * r bytes; allow that plus headroom.
  const maxmem = 128 * N * r * 2;
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r, p, maxmem }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string, log2N: number): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password, salt, log2N, BLOCK_SIZE, PARALLELISM);
  return [
    'scrypt',
    log2N,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

interface Parsed {
  log2N: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

function parse(stored: string): Parsed | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [log2N, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  if (![log2N, r, p].every(Number.isInteger) || log2N < 10 || log2N > 22 || r < 1 || p < 1) {
    return null;
  }
  const salt = Buffer.from(parts[4]!, 'base64');
  const key = Buffer.from(parts[5]!, 'base64');
  if (salt.length < 8 || key.length !== KEY_LENGTH) return null;
  return { log2N, r, p, salt, key };
}

/** True only for the right password. A malformed stored hash never verifies. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;
  const key = await scrypt(password, parsed.salt, parsed.log2N, parsed.r, parsed.p);
  return timingSafeEqual(key, parsed.key);
}

/** True when the hash was made with different parameters than today's. */
export function needsRehash(stored: string, log2N: number): boolean {
  const parsed = parse(stored);
  return !parsed || parsed.log2N !== log2N || parsed.r !== BLOCK_SIZE || parsed.p !== PARALLELISM;
}
