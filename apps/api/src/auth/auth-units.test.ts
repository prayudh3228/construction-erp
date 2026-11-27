import { describe, expect, it, vi } from 'vitest';
import { type Request, type Response } from 'express';
import { DEMO_ENCRYPTION_KEY, loadEnv } from '../config/env';
import { AttemptLimiter, HashGate } from './attempt-limiter';
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
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    AUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  };

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
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', AUTH_ENCRYPTION_KEY: DEMO_ENCRYPTION_KEY }),
    ).toThrow(/demo key/);
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

describe('AttemptLimiter', () => {
  it('blocks a source after N failures in the window, and forgets old ones', () => {
    let now = 0;
    const limiter = new AttemptLimiter(3, 60_000, { now: () => new Date(now) });
    for (let i = 0; i < 3; i++) {
      expect(limiter.isBlocked('1.2.3.4')).toBe(false);
      limiter.recordFailure('1.2.3.4');
    }
    expect(limiter.isBlocked('1.2.3.4')).toBe(true);
    expect(limiter.isBlocked('5.6.7.8')).toBe(false); // other sources unaffected
    now = 60_001; // the window slides past all three
    expect(limiter.isBlocked('1.2.3.4')).toBe(false);
  });
});

describe('HashGate', () => {
  it('runs at most `limit` tasks at once and turns callers away beyond the queue', async () => {
    const gate = new HashGate(2, 1);
    let running = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    const task = () =>
      new Promise<string>((resolve) => {
        running += 1;
        peak = Math.max(peak, running);
        releases.push(() => {
          running -= 1;
          resolve('done');
        });
      });
    const a = gate.run(task);
    const b = gate.run(task);
    const c = gate.run(task); // queued
    const d = await gate.run(task); // queue full
    expect(d).toBeNull();
    expect(peak).toBe(2);
    releases.shift()!();
    await a;
    await new Promise((r) => setTimeout(r, 0));
    releases.shift()!();
    releases.shift()!();
    await expect(Promise.all([b, c])).resolves.toEqual(['done', 'done']);
    expect(peak).toBe(2);
  });
});
