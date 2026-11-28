import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  AUTH_ERROR_CODES,
  type MfaSetupResponse,
  type MfaStatus,
  defaultBranding,
  roleKeySchema,
  roleRequiresMfa,
} from '@erp/shared';
import { apiError } from '../common/api-error';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type Authenticated, AuthService, type RequestMeta } from './auth.service';
import { CLOCK, type Clock } from './clock';
import { SecretBox, newRecoveryCodes, normaliseRecoveryCode } from './secret-box';
import { matchTotp, newTotpSecret, otpauthUri } from './totp';

type Opened = Authenticated & { token: string };

/**
 * Two-factor sign-in with an authenticator app (TOTP) and one-time recovery codes.
 *
 * Every code check reserves an attempt on the same counter as passwords, so wrong codes lead to
 * the same lockout; reaching it ends every session. Whenever a session moves to fully signed in
 * it gets a NEW token, so a token seen before two-factor is worthless afterwards.
 */
@Injectable()
export class MfaService {
  private readonly box: SecretBox;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    @Inject(ENV) env: Env,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.box = new SecretBox(env.AUTH_ENCRYPTION_KEY);
  }

  private required(user: User): boolean {
    return roleRequiresMfa(roleKeySchema.parse(user.roleKey));
  }

  async status(user: User): Promise<MfaStatus> {
    const recoveryCodesLeft = await this.prisma.recoveryCode.count({
      where: { userId: user.id, usedAt: null },
    });
    return {
      enabled: user.totpEnabledAt !== null,
      required: this.required(user),
      recoveryCodesLeft,
    };
  }

  /**
   * Start setting up: a new secret for the app to scan, kept (encrypted) on THIS session until
   * it is confirmed. Asking again from the same session returns the same secret (page opened
   * twice, double click); any other session gets a different one, so a secret seen by someone
   * else can never be the one the real user confirms. A new starter changes the temporary
   * password first.
   */
  async startSetup(auth: Authenticated): Promise<MfaSetupResponse> {
    const { user, session } = auth;
    this.assertCanSetUp(auth);
    // Only the first call on this session stores a secret; parallel calls then read it back.
    await this.prisma.session.updateMany({
      where: { id: session.id, totpPendingSecret: null },
      data: { totpPendingSecret: this.box.encrypt(newTotpSecret()) },
    });
    const secret = await this.pendingSecret(session.id);
    return {
      secret: secret!,
      otpauthUri: otpauthUri(secret!, user.username, defaultBranding.productName),
    };
  }

  /**
   * Finish setup with a code from the app. Two-factor is on; returns the recovery codes once.
   * From a session that did not just type the password (an ordinary signed-in session), the
   * password is asked again, so a stolen session cannot enrol the thief's phone.
   */
  async enable(
    auth: Authenticated,
    code: string,
    password: string | undefined,
    meta: RequestMeta,
  ): Promise<Opened & { recoveryCodes: string[] }> {
    const { user, session } = auth;
    this.assertCanSetUp(auth);
    const secret = await this.pendingSecret(session.id);
    if (!secret) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        AUTH_ERROR_CODES.mfaSetupNotStarted,
        'Start the setup first, then enter the code from your app.',
      );
    }
    if (!auth.freshFromPassword) await this.confirmPassword(auth, password);
    const step = await this.checkTotp(auth, secret, code);
    const now = this.clock.now();
    const recoveryCodes = newRecoveryCodes();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.recoveryCode.createMany({
        data: recoveryCodes.map((c) => ({ userId: user.id, codeHash: this.box.hash(c) })),
      });
      // Only if still off: two sessions confirming at the same moment cannot both win.
      const switched = await tx.user.updateMany({
        where: { id: user.id, totpEnabledAt: null },
        data: {
          totpSecret: this.box.encrypt(secret),
          totpEnabledAt: now,
          totpLastStep: step,
          failedLoginCount: 0,
          lastLoginAt: now,
        },
      });
      if (switched.count === 0) {
        throw apiError(
          HttpStatus.CONFLICT,
          'MFA_ALREADY_ENABLED',
          'Two-factor sign-in is already on.',
        );
      }
      return tx.user.findUniqueOrThrow({ where: { id: user.id } });
    });
    // Other sessions were opened without two-factor: end them all, continue on a new one.
    await this.auth.revokeAllSessions(user.id, 'mfa_enabled');
    const opened = await this.auth.openSession(updated, clientOf(session), meta);
    return { ...opened, recoveryCodes };
  }

  private assertCanSetUp({ user, session }: Authenticated): void {
    if (session.stage === 'MFA_VERIFY' || user.totpEnabledAt) {
      throw apiError(
        HttpStatus.CONFLICT,
        'MFA_ALREADY_ENABLED',
        'Two-factor sign-in is already on for this account.',
      );
    }
    if (user.mustChangePassword) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        AUTH_ERROR_CODES.passwordChangeRequired,
        'Please change your password first, then set up two-factor sign-in.',
      );
    }
  }

  /** The secret being set up on this session, read fresh from the database (never a snapshot). */
  private async pendingSecret(sessionId: string): Promise<string | null> {
    const row = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { totpPendingSecret: true },
    });
    return row?.totpPendingSecret ? this.box.decrypt(row.totpPendingSecret) : null;
  }

  /** Second step of sign-in: an authenticator code or one recovery code. */
  async verify(
    auth: Authenticated,
    input: { code: string } | { recoveryCode: string },
    meta: RequestMeta,
  ): Promise<Opened> {
    const { user, session } = auth;
    if (session.stage !== 'MFA_VERIFY' || !user.totpEnabledAt || !user.totpSecret) {
      throw apiError(
        HttpStatus.CONFLICT,
        'MFA_NOT_PENDING',
        'There is no code to enter for this session.',
      );
    }
    let updated: User;
    if ('code' in input) {
      const step = await this.checkTotp(auth, this.box.decrypt(user.totpSecret), input.code);
      updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { totpLastStep: step, failedLoginCount: 0, lastLoginAt: this.clock.now() },
      });
    } else {
      await this.useRecoveryCode(auth, input.recoveryCode);
      updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lastLoginAt: this.clock.now() },
      });
    }
    await this.auth.logout(session.id);
    return this.auth.openSession(updated, clientOf(session), meta);
  }

  /** New set of recovery codes (the old ones stop working). Needs the password and an app code. */
  async regenerateRecoveryCodes(
    auth: Authenticated,
    code: string,
    password: string,
  ): Promise<string[]> {
    const { user } = auth;
    if (!user.totpEnabledAt || !user.totpSecret) {
      throw apiError(HttpStatus.CONFLICT, 'MFA_NOT_ENABLED', 'Two-factor sign-in is not on.');
    }
    await this.confirmPassword(auth, password);
    const step = await this.checkTotp(auth, this.box.decrypt(user.totpSecret), code);
    const recoveryCodes = newRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.recoveryCode.createMany({
        data: recoveryCodes.map((c) => ({ userId: user.id, codeHash: this.box.hash(c) })),
      });
      await tx.user.update({
        where: { id: user.id },
        data: { totpLastStep: step, failedLoginCount: 0 },
      });
    });
    return recoveryCodes;
  }

  /** Switch two-factor off. Not for roles that must use it. Needs the password and an app code. */
  async disable(auth: Authenticated, code: string, password: string): Promise<User> {
    const { user } = auth;
    if (this.required(user)) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        AUTH_ERROR_CODES.mfaCannotDisable,
        'Your role must use two-factor sign-in, so it cannot be switched off.',
      );
    }
    if (!user.totpEnabledAt || !user.totpSecret) {
      throw apiError(HttpStatus.CONFLICT, 'MFA_NOT_ENABLED', 'Two-factor sign-in is not on.');
    }
    await this.confirmPassword(auth, password);
    await this.checkTotp(auth, this.box.decrypt(user.totpSecret), code);
    return this.prisma.$transaction(async (tx) => {
      await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
      return tx.user.update({
        where: { id: user.id },
        data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, failedLoginCount: 0 },
      });
    });
  }

  /**
   * Ask for the password again before a sensitive change. Counts on the shared attempt counter:
   * wrong is 400, and when that was the last try the account locks and every session ends.
   */
  private async confirmPassword(auth: Authenticated, password: string | undefined): Promise<void> {
    const now = this.clock.now();
    const reserved = await this.auth.reserveAttempt(auth.user.id, now);
    if (!reserved) {
      await this.auth.revokeAllSessions(auth.user.id, 'too_many_attempts');
      throw this.auth.unauthenticated();
    }
    if (password && (await this.auth.verifyGated(password, auth.user.passwordHash))) return;
    if (await this.auth.afterFailure(auth.user.id, reserved.failedLoginCount, now)) {
      await this.auth.revokeAllSessions(auth.user.id, 'too_many_attempts');
      throw this.auth.unauthenticated();
    }
    throw apiError(
      HttpStatus.BAD_REQUEST,
      AUTH_ERROR_CODES.wrongCurrentPassword,
      password ? 'Your password is not right.' : 'Enter your password to confirm this change.',
    );
  }

  /**
   * Check an app code on the shared attempt counter. Returns the matched step. Wrong: 400, or
   * when that was the last try, the account locks, every session ends and the answer is 401.
   */
  private async checkTotp(auth: Authenticated, secret: string, code: string): Promise<number> {
    const now = this.clock.now();
    const reserved = await this.auth.reserveAttempt(auth.user.id, now);
    if (!reserved) {
      await this.auth.revokeAllSessions(auth.user.id, 'too_many_attempts');
      throw this.auth.unauthenticated();
    }
    // Re-read the last used step: another request may have used a code a moment ago.
    const { totpLastStep } = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.user.id },
      select: { totpLastStep: true },
    });
    const step = matchTotp(secret, code, now, totpLastStep);
    if (step === null) {
      await this.failed(auth, reserved.failedLoginCount, now);
    } else {
      // Claim the step atomically, so the same code cannot pass twice in parallel.
      const claimed = await this.prisma.user.updateMany({
        where: {
          id: auth.user.id,
          OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
        },
        data: { totpLastStep: step },
      });
      if (claimed.count === 0) await this.failed(auth, reserved.failedLoginCount, now);
    }
    return step!;
  }

  private async useRecoveryCode(auth: Authenticated, input: string): Promise<void> {
    const now = this.clock.now();
    const reserved = await this.auth.reserveAttempt(auth.user.id, now);
    if (!reserved) {
      await this.auth.revokeAllSessions(auth.user.id, 'too_many_attempts');
      throw this.auth.unauthenticated();
    }
    // Mark it used in the same statement that finds it: a code works exactly once.
    const used = await this.prisma.recoveryCode.updateMany({
      where: {
        userId: auth.user.id,
        codeHash: this.box.hash(normaliseRecoveryCode(input)),
        usedAt: null,
      },
      data: { usedAt: now },
    });
    if (used.count === 0) await this.failed(auth, reserved.failedLoginCount, now);
  }

  private async failed(auth: Authenticated, count: number, now: Date): Promise<never> {
    if (await this.auth.afterFailure(auth.user.id, count, now)) {
      await this.auth.revokeAllSessions(auth.user.id, 'too_many_attempts');
      throw this.auth.unauthenticated();
    }
    throw apiError(
      HttpStatus.BAD_REQUEST,
      AUTH_ERROR_CODES.invalidMfaCode,
      'That code is not right, or has already been used. Codes change every 30 seconds.',
    );
  }
}

function clientOf(session: Authenticated['session']): 'web' | 'mobile' {
  return session.client === 'MOBILE' ? 'mobile' : 'web';
}
