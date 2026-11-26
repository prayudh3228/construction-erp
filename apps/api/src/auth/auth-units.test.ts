import { describe, expect, it, vi } from 'vitest';
import { type Request, type Response } from 'express';
import { loadEnv } from '../config/env';
import { clientHeaderMiddleware } from './client-header.middleware';
import { hashPassword, needsRehash, verifyPassword } from './password-hasher';
import { hashSessionToken, looksLikeSessionToken, newSessionToken } from './session-token';

const COST = 11; // fast for unit tests

describe('password hasher', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('river stone lantern 47', COST);
    expect(hash).toMatch(/^scrypt\$11\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    await expect(verifyPassword('river stone lantern 47', hash)).resolves.toBe(true);
    await expect(verifyPassword('river stone lantern 48', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('salts every hash, so the same password never hashes the same twice', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same words', COST),
      hashPassword('same words', COST),
    ]);
    expect(a).not.toBe(b);
  });

  it('treats visually identical Unicode forms as the same password (NFKC)', async () => {
    // "é" as one code point vs "e" + combining accent.
    const hash = await hashPassword('café lantern 47', COST);
    await expect(verifyPassword('café lantern 47', hash)).resolves.toBe(true);
  });

  it('never verifies a malformed or tampered hash', async () => {
    const hash = await hashPassword('x', COST);
    for (const bad of [
      '',
      'plain',
      hash.replace('scrypt', 'bcrypt'),
      hash.replace('$11$', '$99$'),
      `${hash}$extra`,
    ]) {
      await expect(verifyPassword('x', bad)).resolves.toBe(false);
    }
  });

  it('flags hashes made with other parameters for upgrade', async () => {
    const hash = await hashPassword('x', COST);
    expect(needsRehash(hash, COST)).toBe(false);
    expect(needsRehash(hash, COST + 1)).toBe(true);
    expect(needsRehash('garbage', COST)).toBe(true);
  });
});

describe('session tokens', () => {
  it('are 256-bit, URL-safe, unique, and stored only as a SHA-256 hash', () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(hashSessionToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(a)).toBe(hashSessionToken(a));
    expect(hashSessionToken(a)).not.toBe(a);
  });

  it('reject anything that is not token-shaped before any lookup', () => {
    expect(looksLikeSessionToken(newSessionToken())).toBe(true);
    for (const bad of [undefined, null, 42, '', 'short', 'a'.repeat(44), `${'a'.repeat(42)}!`]) {
      expect(looksLikeSessionToken(bad)).toBe(false);
    }
  });
});

describe('auth environment', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

  it('has safe defaults: 30 min idle, 12 h max, 5 tries then 15 min lock, demo off', () => {
    const env = loadEnv({ ...base });
    expect(env).toMatchObject({
      AUTH_IDLE_TIMEOUT_MINUTES: 30,
      AUTH_ABSOLUTE_TIMEOUT_HOURS: 12,
      AUTH_MAX_FAILED_LOGINS: 5,
      AUTH_LOCKOUT_MINUTES: 15,
      AUTH_DEMO_LOGIN: false,
      PASSWORD_HASH_COST: 17,
    });
  });

  it('refuses demo sign-in and weak hashing in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', AUTH_DEMO_LOGIN: 'true' })).toThrow(
      /Demo sign-in must never be enabled in production/,
    );
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', PASSWORD_HASH_COST: '12' })).toThrow(
      /at least 17/,
    );
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).not.toThrow();
  });

  it('reads boolean flags strictly', () => {
    expect(loadEnv({ ...base, AUTH_DEMO_LOGIN: '1' }).AUTH_DEMO_LOGIN).toBe(true);
    expect(loadEnv({ ...base, AUTH_DEMO_LOGIN: 'false' }).AUTH_DEMO_LOGIN).toBe(false);
    expect(() => loadEnv({ ...base, AUTH_DEMO_LOGIN: 'yes' })).toThrow();
  });
});

describe('client header (CSRF) middleware', () => {
  function run(method: string, header?: string) {
    const req = { method, headers: header ? { 'x-erp-client': header } : {} } as unknown as Request;
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })) } as unknown as Response;
    const next = vi.fn();
    clientHeaderMiddleware(req, res, next);
    return { next, res, json };
  }

  it('lets reads through without the header', () => {
    expect(run('GET').next).toHaveBeenCalled();
    expect(run('HEAD').next).toHaveBeenCalled();
    expect(run('OPTIONS').next).toHaveBeenCalled();
  });

  it('requires a known client on every write', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const { next, res } = run(method);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    }
    expect(run('POST', 'evil').next).not.toHaveBeenCalled();
    expect(run('POST', 'web').next).toHaveBeenCalled();
    expect(run('POST', 'mobile').next).toHaveBeenCalled();
  });
});
