import {
  type AuthUser,
  type DepartmentAccess,
  type LoginResponse,
  type MeResponse,
  type RoleKey,
} from '@erp/shared';
import { DEMO_ACCOUNTS } from '@erp/shared/demo';
import { vi } from 'vitest';
import { ApiRequestError } from '@/api/client';
import { type AuthClient, setAccessResolver, setAuthClient } from '@/app/auth';

export const FAKE_PASSWORD = 'river stone lantern 47';

export function fakeMe(
  user: Partial<AuthUser> = {},
  session: Partial<MeResponse['session']> = {},
): MeResponse {
  const now = Date.now();
  return {
    user: {
      id: '0b9d7c1e-2f0a-4b8e-9a51-3d2c1b0a9f8e',
      username: 'test.user',
      displayName: 'Test User',
      email: 'test.user@example.com',
      role: 'site',
      mustChangePassword: false,
      ...user,
    },
    session: {
      idleExpiresAt: new Date(now + 30 * 60_000).toISOString(),
      absoluteExpiresAt: new Date(now + 12 * 3_600_000).toISOString(),
      idleTimeoutSeconds: 30 * 60,
      ...session,
    },
  };
}

const failed = () =>
  new ApiRequestError(
    401,
    'INVALID_CREDENTIALS',
    'Sign-in failed. Check your username and password.',
  );

/** An in-memory API for sign-in. Knows any username with FAKE_PASSWORD, and the demo accounts. */
export class FakeAuth implements AuthClient {
  current: MeResponse | null = null;
  /** The next me() call fails with this, once. */
  meError: Error | null = null;

  me = vi.fn(async () => {
    if (this.meError) {
      const e = this.meError;
      this.meError = null;
      throw e;
    }
    return this.current;
  });

  login = vi.fn(async (username: string, password: string): Promise<LoginResponse> => {
    if (password !== FAKE_PASSWORD) throw failed();
    this.current = fakeMe({ username, displayName: 'Asha Rao' });
    return this.current;
  });

  demoLogin = vi.fn(async (username: string): Promise<LoginResponse> => {
    const account = DEMO_ACCOUNTS.find((a) => a.username === username);
    if (!account) throw failed();
    this.current = fakeMe({ username, displayName: account.displayName, role: account.role });
    return this.current;
  });

  logout = vi.fn(async () => {
    this.current = null;
  });

  changePassword = vi.fn(async (currentPassword: string, newPassword: string) => {
    if (!this.current) throw new ApiRequestError(401, 'UNAUTHENTICATED', 'Please sign in.');
    if (currentPassword !== FAKE_PASSWORD) {
      throw new ApiRequestError(
        400,
        'WRONG_CURRENT_PASSWORD',
        'Your current password is not right.',
      );
    }
    if (newPassword.includes('server-says-no')) {
      throw new ApiRequestError(400, 'WEAK_PASSWORD', 'Choose a stronger password.', [
        'The server found a problem.',
      ]);
    }
    this.current = { ...this.current, user: { ...this.current.user, mustChangePassword: false } };
    return this.current;
  });
}

export let fakeAuth = new FakeAuth();

/** Fresh fake API before each test (signed out). */
export function resetFakeAuth(): void {
  fakeAuth = new FakeAuth();
  setAuthClient(fakeAuth);
  setAccessResolver(() => ({ all: true }));
}

/** Start the test signed in. `access` limits the visible departments (provisional until Phase 3). */
export function signIn(
  access: DepartmentAccess = { all: true },
  name = 'Test User',
  extra: Partial<AuthUser> & { role?: RoleKey } = {},
): MeResponse {
  fakeAuth.current = fakeMe({ displayName: name, ...extra });
  setAccessResolver(() => access);
  return fakeAuth.current;
}
