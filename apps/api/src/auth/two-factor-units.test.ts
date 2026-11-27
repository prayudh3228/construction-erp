import { describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { SecretBox, newRecoveryCodes, normaliseRecoveryCode } from './secret-box';
import {
  base32Decode,
  base32Encode,
  matchTotp,
  newTotpSecret,
  otpauthUri,
  totpCode,
  totpStep,
} from './totp';

/** RFC 6238 appendix B: secret "12345678901234567890" (ASCII), SHA-1, 30 s steps. */
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it.each([
    // [unix seconds, the RFC's 8-digit value]; apps show the last 6 digits.
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('at %i s the code is the last 6 digits of %s', (seconds, rfc) => {
    expect(totpCode(RFC_SECRET, totpStep(new Date(seconds * 1000)))).toBe(rfc.slice(-6));
  });

  it('base32 round-trips and ignores spaces, dashes and case', () => {
    const bytes = Buffer.from([0, 1, 2, 253, 254, 255, 42]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(base32Decode('gezd gnbv-gy3tqojq')).toEqual(base32Decode('GEZDGNBVGY3TQOJQ'));
    expect(() => base32Decode('not base32!')).toThrow();
  });

  it('new secrets are 160 random bits', () => {
    const a = newTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(a)).toHaveLength(20);
    expect(newTotpSecret()).not.toBe(a);
  });

  it('accepts one step of clock drift either way, not two', () => {
    const at = new Date(1234567890 * 1000);
    const step = totpStep(at);
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step), at, null)).toBe(step);
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), at, null)).toBe(step - 1);
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), at, null)).toBe(step + 1);
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), at, null)).toBeNull();
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 2), at, null)).toBeNull();
  });

  it('never accepts a code from a step already used (no replay)', () => {
    const at = new Date(1234567890 * 1000);
    const step = totpStep(at);
    const code = totpCode(RFC_SECRET, step);
    expect(matchTotp(RFC_SECRET, code, at, step)).toBeNull();
    expect(matchTotp(RFC_SECRET, code, at, step - 1)).toBe(step);
    // An older code is refused once a newer one was used.
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), at, step)).toBeNull();
  });

  it('accepts spaces in the typed code but nothing that is not 6 digits', () => {
    const at = new Date(59 * 1000);
    expect(matchTotp(RFC_SECRET, '287 082', at, null)).not.toBeNull();
    for (const bad of ['', '28708', '2870822', 'abcdef', '28708a']) {
      expect(matchTotp(RFC_SECRET, bad, at, null)).toBeNull();
    }
  });

  it('builds the otpauth link authenticator apps read', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'demo.admin', 'Construction ERP');
    expect(uri).toBe(
      'otpauth://totp/Construction%20ERP:demo.admin?secret=JBSWY3DPEHPK3PXP&issuer=Construction+ERP&algorithm=SHA1&digits=6&period=30',
    );
  });
});

describe('SecretBox', () => {
  const key = Buffer.alloc(32, 9).toString('base64');

  it('encrypts so the stored value reveals nothing, and decrypts back', () => {
    const box = new SecretBox(key);
    const a = box.encrypt('JBSWY3DPEHPK3PXP');
    const b = box.encrypt('JBSWY3DPEHPK3PXP');
    expect(a).toMatch(/^v1:/);
    expect(a).not.toContain('JBSWY3DP');
    expect(a).not.toBe(b); // random IV
    expect(box.decrypt(a)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('refuses a tampered value or the wrong key', () => {
    const box = new SecretBox(key);
    const stored = box.encrypt('secret');
    const raw = Buffer.from(stored.slice(3), 'base64');
    raw[raw.length - 1]! ^= 1;
    expect(() => box.decrypt(`v1:${raw.toString('base64')}`)).toThrow();
    expect(() => new SecretBox(Buffer.alloc(32, 1).toString('base64')).decrypt(stored)).toThrow();
    expect(() => box.decrypt('plain')).toThrow();
  });

  it('needs exactly 32 bytes of key', () => {
    expect(() => new SecretBox(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });

  it('keyed hashes differ by key, so a stolen table cannot be tested without it', () => {
    const a = new SecretBox(key).hash('ABCDE-FGHJK');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(new SecretBox(key).hash('ABCDE-FGHJK')).toBe(a);
    expect(new SecretBox(Buffer.alloc(32, 1).toString('base64')).hash('ABCDE-FGHJK')).not.toBe(a);
  });
});

describe('recovery codes', () => {
  it('ten unique codes like ABCDE-FGHJK without look-alike characters', () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
  });

  it('typed codes are normalised: case, spaces and dashes do not matter', () => {
    expect(normaliseRecoveryCode(' abcde fghjk ')).toBe('ABCDE-FGHJK');
    expect(normaliseRecoveryCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
    expect(normaliseRecoveryCode('abc')).toBe('ABC');
  });
});

describe('encryption key setting', () => {
  it('is required and must be 32 bytes', () => {
    const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };
    expect(() => loadEnv(base)).toThrow(/AUTH_ENCRYPTION_KEY/);
    expect(() => loadEnv({ ...base, AUTH_ENCRYPTION_KEY: 'c2hvcnQ=' })).toThrow(/32 random bytes/);
  });
});
