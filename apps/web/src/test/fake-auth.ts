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
/** The one authenticator code the fake API accepts, and its one recovery code. */
export const FAKE_TOTP = '246810';
export const FAKE_RECOVERY = 'ABCDE-FGHJK';
export const FAKE_RECOVERY_CODES = Array.from({ length: 10 }, (_, i) => `CODE${i}-ABCDE`);

const wrongCode = () =>
  new ApiRequestError(
    400,
    'INVALID_MFA_CODE',
    'That code is not right, or has already been used. Codes change every 30 seconds.',
  );

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
      mfa: { enabled: false, required: false },
      ...user,
    },
    session: {
      stage: 'full',
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

  /**
   * Usernames choose the case: "...mfa-on..." has two-factor on (enter a code),
   * "...mfa-setup..." must set it up first; anything else is signed in at once.
   */
  login = vi.fn(async (username: string, password: string): Promise<LoginResponse> => {
    if (password !== FAKE_PASSWORD) throw failed();
    if (username.includes('mfa-on')) {
      this.current = fakeMe(
        {
          username,
          displayName: 'Asha Rao',
          role: 'finance',
          mfa: { enabled: true, required: true },
        },
        { stage: 'mfa_verify' },
      );
    } else if (username.includes('mfa-setup')) {
      this.current = fakeMe(
        {
          username,
          displayName: 'Asha Rao',
          role: 'finance',
          mfa: { enabled: false, required: true },
        },
        { stage: 'mfa_setup' },
      );
    } else {
      this.current = fakeMe({ username, displayName: 'Asha Rao' });
    }
    return this.current;
  });

  /** Wrong codes before the fake API locks the account (answers 401). */
  wrongCodesLeft = 5;
  recoveryCodesLeft = 10;

  private checkCode(code: string) {
    if (code.replace(/\s/g, '') === FAKE_TOTP) return;
    this.wrongCodesLeft -= 1;
    if (this.wrongCodesLeft <= 0) {
      this.current = null;
      throw new ApiRequestError(401, 'UNAUTHENTICATED', 'Please sign in.');
    }
    throw wrongCode();
  }

  private fullSession(mfaEnabled: boolean): MeResponse {
    const current = this.current!;
    this.current = {
      user: { ...current.user, mfa: { ...current.user.mfa, enabled: mfaEnabled } },
      session: { ...current.session, stage: 'full' },
    };
    return this.current;
  }

  mfaStatus = vi.fn(async () => ({
    enabled: this.current?.user.mfa.enabled ?? false,
    required: this.current?.user.mfa.required ?? false,
    recoveryCodesLeft: this.current?.user.mfa.enabled ? this.recoveryCodesLeft : 0,
  }));

  mfaSetup = vi.fn(async () => ({
    secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    otpauthUri:
      'otpauth://totp/Construction%20ERP:test.user?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Construction+ERP',
  }));

  mfaEnable = vi.fn(async (code: string, password?: string) => {
    if (this.current?.session.stage === 'full' && password !== FAKE_PASSWORD) {
      throw new ApiRequestError(
        400,
        'WRONG_CURRENT_PASSWORD',
        'Enter your password to confirm this change.',
      );
    }
    this.checkCode(code);
    return { ...this.fullSession(true), recoveryCodes: FAKE_RECOVERY_CODES };
  });

  mfaVerify = vi.fn(async (input: { code: string } | { recoveryCode: string }) => {
    if ('code' in input) this.checkCode(input.code);
    else if (
      input.recoveryCode.toUpperCase().replace(/[^A-Z0-9]/g, '') !== FAKE_RECOVERY.replace('-', '')
    ) {
      throw wrongCode();
    }
    return this.fullSession(true);
  });

  mfaRegenerateCodes = vi.fn(async (code: string, password: string) => {
    if (password !== FAKE_PASSWORD) {
      throw new ApiRequestError(400, 'WRONG_CURRENT_PASSWORD', 'Your password is not right.');
    }
    this.checkCode(code);
    this.recoveryCodesLeft = 10;
    return FAKE_RECOVERY_CODES;
  });

  mfaDisable = vi.fn(async (code: string, password: string) => {
    if (password !== FAKE_PASSWORD) {
      throw new ApiRequestError(400, 'WRONG_CURRENT_PASSWORD', 'Your password is not right.');
    }
    if (this.current?.user.mfa.required) {
      throw new ApiRequestError(
        403,
        'MFA_CANNOT_DISABLE',
        'Your role must use two-factor sign-in.',
      );
    }
    this.checkCode(code);
    return this.fullSession(false);
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
