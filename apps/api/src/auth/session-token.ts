import { createHash, randomBytes } from 'node:crypto';

/** A new session token: 256 random bits, URL-safe. Only its hash is stored. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 is right here (not a slow hash): the token is random, not a guessable password. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Tokens are 43 base64url characters; anything else is rejected before touching the database. */
export function looksLikeSessionToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}
