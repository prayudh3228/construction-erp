import { describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS, isDemoUsername } from '../demo/index.js';
import { authUserSchema, loginRequestSchema } from './api.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, checkPassword } from './password-policy.js';
import { ROLE_KEYS, roleRequiresMfa } from './roles.js';

describe('checkPassword', () => {
  it('accepts a long, unpredictable passphrase', () => {
    expect(checkPassword('river stone lantern 47')).toEqual([]);
    expect(checkPassword('Kh7#mQ2!vRt9')).toEqual([]);
  });

  it('length is counted in characters people see, at the boundaries', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(checkPassword('Kh7#mQ2!vRt')).toContain('too_short'); // 11
    expect(checkPassword('Kh7#mQ2!vRt9')).not.toContain('too_short'); // 12
    // 11 Devanagari letters + 1 digit = 12 characters, though more than 12 UTF-16 units.
    expect(checkPassword('कमलनयनसरलगह1')).not.toContain('too_short');
    // 6 emoji are 12 UTF-16 units but only 6 characters.
    expect(checkPassword('🏗️🏗️🏗️')).toContain('too_short');
    expect(checkPassword('x'.repeat(PASSWORD_MAX_LENGTH + 1))).toContain('too_long');
  });

  it('rejects well-known passwords, ignoring case and spaces', () => {
    expect(checkPassword('Password1234')).toContain('common');
    expect(checkPassword('Welcome@1234')).toContain('common');
    expect(checkPassword('construction')).toContain('common');
    expect(checkPassword('my password is long')).toContain('common'); // contains "password"
    expect(checkPassword('QWERTYUIOP12')).toContain('common');
  });

  it('rejects repeated characters and simple sequences', () => {
    expect(checkPassword('aaaaaaaaaaaa')).toContain('repetitive');
    expect(checkPassword('abababababab')).toContain('repetitive');
    expect(checkPassword('abcdefghijklm')).toContain('repetitive');
    expect(checkPassword('zyxwvutsrqpon')).toContain('repetitive');
    expect(checkPassword('Kh7#mQ2!vRt9')).not.toContain('repetitive');
  });

  it('rejects passwords that contain the person’s own details (4+ characters)', () => {
    const ctx = { username: 'asha.rao', email: 'asharao@example.com', displayName: 'Asha Rao' };
    expect(checkPassword('lantern asha.rao 47', ctx)).toContain('contains_personal_info');
    expect(checkPassword('ASHARAO river stone', ctx)).toContain('contains_personal_info');
    expect(checkPassword('river Asha stone 47', ctx)).toContain('contains_personal_info');
    // "Rao" is under 4 characters, so it is not checked on its own.
    expect(checkPassword('river rao stone 47', ctx)).not.toContain('contains_personal_info');
  });

  it('reports every problem at once', () => {
    expect(checkPassword('aaaa')).toEqual(['too_short', 'repetitive']);
  });
});

describe('roles', () => {
  it('two-factor is required for Admin, Director and Finance only', () => {
    expect(ROLE_KEYS.filter(roleRequiresMfa)).toEqual(['admin', 'director', 'finance']);
  });
});

describe('demo accounts', () => {
  it('one per role, unique usernames, all marked as demo', () => {
    expect(new Set(DEMO_ACCOUNTS.map((a) => a.role))).toEqual(new Set(ROLE_KEYS));
    expect(new Set(DEMO_ACCOUNTS.map((a) => a.username)).size).toBe(DEMO_ACCOUNTS.length);
    for (const a of DEMO_ACCOUNTS) expect(a.displayName).toMatch(/^Demo /);
  });

  it('isDemoUsername matches only demo accounts, case-insensitively', () => {
    expect(isDemoUsername(' Demo.Director ')).toBe(true);
    expect(isDemoUsername('director')).toBe(false);
  });
});

describe('auth schemas', () => {
  it('login trims the username and keeps the password exactly', () => {
    expect(loginRequestSchema.parse({ username: ' asha ', password: ' x ' })).toEqual({
      username: 'asha',
      password: ' x ',
    });
  });

  it('auth user rejects an unknown role', () => {
    const user = {
      id: '0b9d7c1e-2f0a-4b8e-9a51-3d2c1b0a9f8e',
      username: 'a',
      displayName: 'A',
      email: null,
      role: 'boss',
      mustChangePassword: false,
    };
    expect(authUserSchema.safeParse(user).success).toBe(false);
  });
});
