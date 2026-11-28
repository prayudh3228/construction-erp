import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  AUTH_ERROR_CODES,
  type AuthUser,
  type ClientKind,
  type DeviceSession,
  PASSWORD_PROBLEM_MESSAGES,
  type SessionInfo,
  checkPassword,
  roleKeySchema,
  roleRequiresMfa,
} from '@erp/shared';
import { isDemoUsername } from '@erp/shared/demo';
import { apiError } from '../common/api-error';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { type Session, type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HashGate } from './attempt-limiter';
import { CLOCK, type Clock } from './clock';
import { hashPassword, needsRehash, verifyPassword } from './password-hasher';
import { hashSessionToken, looksLikeSessionToken, newSessionToken } from './session-token';

export interface RequestMeta {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

export interface Authenticated {
  user: User;
  /** `stage` is the EFFECTIVE stage (see authenticate). */
  session: Session;
  /**
   * The password was typed for this session moments ago (a half-signed-in session, at most
   * AUTH_MFA_PENDING_MINUTES old). Otherwise sensitive changes ask for it again.
   */
  freshFromPassword: boolean;
}

/** Same words for every sign-in failure, so the API never reveals which accounts exist. */
const SIGN_IN_FAILED =
  'Sign-in failed. Check your username and password. After several failed attempts the account is locked for a while.';

const STAGE_NAMES = { FULL: 'full', MFA_VERIFY: 'mfa_verify', MFA_SETUP: 'mfa_setup' } as const;

/** A UUID no user has: the attempt query for an unknown username touches no row. */
const UNKNOWN_USER_ID = '00000000-0000-0000-0000-000000000000';

/** lastSeenAt is written at most once a minute per session, not on every request. */
const TOUCH_INTERVAL_MS = 60_000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

@Injectable()
export class AuthService {
  /** Hash of a random password, verified for unknown users so failures take the same time. */
  private dummyHash: Promise<string>;
  /** Password hashing is memory-hungry: cap how many run at once (A38). */
  private readonly hashGate = new HashGate(8, 64);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.dummyHash = hashPassword(newSessionToken(), env.PASSWORD_HASH_COST);
  }

  idleTimeoutMs(client: Session['client']): number {
    return client === 'MOBILE'
      ? this.env.AUTH_MOBILE_IDLE_TIMEOUT_HOURS * HOUR
      : this.env.AUTH_IDLE_TIMEOUT_MINUTES * MINUTE;
  }

  absoluteTimeoutMs(client: Session['client']): number {
    return client === 'MOBILE'
      ? this.env.AUTH_MOBILE_ABSOLUTE_TIMEOUT_DAYS * DAY
      : this.env.AUTH_ABSOLUTE_TIMEOUT_HOURS * HOUR;
  }

  /**
   * Check a username (or email) and password and open a session. Every failure looks the same.
   *
   * Each attempt is RESERVED in the database before the (slow) password check, in one atomic
   * update that only succeeds while the account is not locked and has attempts left. So a burst
   * of parallel guesses gets at most AUTH_MAX_FAILED_LOGINS password checks, never more.
   */
  async login(
    identifier: string,
    password: string,
    client: ClientKind,
    meta: RequestMeta,
  ): Promise<Authenticated & { token: string }> {
    const key = identifier.trim().toLowerCase();
    const now = this.clock.now();
    const user = await this.prisma.user.findUnique({
      where: key.includes('@') ? { email: key } : { username: key },
    });

    // The same database round trip for unknown users, so timing does not reveal accounts.
    const reserved = await this.reserveAttempt(user?.id ?? UNKNOWN_USER_ID, now);
    if (!user || !reserved) {
      await this.verifyGated(password, await this.dummyHash);
      throw this.signInFailed();
    }

    const valid = await this.verifyGated(password, user.passwordHash);
    if (!valid) {
      await this.afterFailure(user.id, reserved.failedLoginCount, now);
      throw this.signInFailed();
    }
    // Checked after the password, so a leaver's account answers exactly like a wrong password.
    if (user.status !== 'ACTIVE') throw this.signInFailed();

    const stage = this.stageAfterPassword(user);
    const passwordHash = needsRehash(user.passwordHash, this.env.PASSWORD_HASH_COST)
      ? await hashPassword(password, this.env.PASSWORD_HASH_COST)
      : undefined;
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        // With a code still to come the counter is NOT reset (only a right code does that), or
        // someone with the password could sign in again after every few wrong codes and guess
        // forever. The right password itself does not use up a try either, so a person who gets
        // both right is never locked out by their own earlier typos.
        ...(stage === 'MFA_VERIFY'
          ? { failedLoginCount: { decrement: 1 } }
          : { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now }),
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    return this.openSession(updated, client, meta, { stage });
  }

  /**
   * After the right password: users with two-factor on must enter a code; users whose role
   * requires it but who have not set it up must set it up; everyone else is signed in.
   */
  stageAfterPassword(user: User): Session['stage'] {
    if (user.totpEnabledAt) return 'MFA_VERIFY';
    if (roleRequiresMfa(roleKeySchema.parse(user.roleKey))) return 'MFA_SETUP';
    return 'FULL';
  }

  /**
   * Count one attempt, atomically, if the account may try now. Returns the new count, or null
   * when the account is locked or already has an attempt in flight for every remaining try.
   */
  /** Internal to the auth module (also used by MfaService). */
  async reserveAttempt(userId: string, now: Date): Promise<{ failedLoginCount: number } | null> {
    const rows = await this.prisma.$queryRaw<{ failed_login_count: number }[]>`
      UPDATE users
         SET failed_login_count = failed_login_count + 1
       WHERE id = ${userId}::uuid
         AND (locked_until IS NULL OR locked_until <= ${now})
         AND failed_login_count < ${this.env.AUTH_MAX_FAILED_LOGINS}
      RETURNING failed_login_count`;
    const row = rows[0];
    if (row) return { failedLoginCount: row.failed_login_count };
    // Refused. If the tries are used up but no lock is running (the last try was a right
    // password with a code still due, or a process stopped mid-attempt), start the lock now, so
    // the account unlocks after AUTH_LOCKOUT_MINUTES instead of staying stuck.
    await this.prisma.$executeRaw`
      UPDATE users
         SET locked_until = ${new Date(now.getTime() + this.env.AUTH_LOCKOUT_MINUTES * MINUTE)},
             failed_login_count = 0
       WHERE id = ${userId}::uuid
         AND failed_login_count >= ${this.env.AUTH_MAX_FAILED_LOGINS}
         AND (locked_until IS NULL OR locked_until <= ${now})`;
    return null;
  }

  /** A reserved attempt failed: lock the account when it used the last try. */
  async afterFailure(userId: string, count: number, now: Date): Promise<boolean> {
    if (count < this.env.AUTH_MAX_FAILED_LOGINS) return false;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lockedUntil: new Date(now.getTime() + this.env.AUTH_LOCKOUT_MINUTES * MINUTE),
      },
    });
    return true;
  }

  /** Password check behind the hash gate; 503 when the server is flooded with sign-ins. */
  async verifyGated(password: string, hash: string): Promise<boolean> {
    const result = await this.hashGate.run(() => verifyPassword(password, hash));
    if (result === null) {
      throw apiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        AUTH_ERROR_CODES.serverBusy,
        'The server is busy. Please try again in a moment.',
      );
    }
    return result;
  }

  /**
   * One-click sign-in for seeded demo accounts. Only when AUTH_DEMO_LOGIN=true, which the config
   * refuses in production; only for the fixed demo usernames; only for active accounts. It skips
   * two-factor on purpose, so the demo can be reviewed without an authenticator app (A41).
   */
  async demoLogin(
    usernameInput: string,
    client: ClientKind,
    meta: RequestMeta,
  ): Promise<Authenticated & { token: string }> {
    if (!this.env.AUTH_DEMO_LOGIN) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        AUTH_ERROR_CODES.demoLoginDisabled,
        'Demo sign-in is not available.',
      );
    }
    const username = usernameInput.trim().toLowerCase();
    const user = isDemoUsername(username)
      ? await this.prisma.user.findUnique({ where: { username } })
      : null;
    if (!user || user.status !== 'ACTIVE') throw this.signInFailed();
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: this.clock.now() },
    });
    return this.openSession(updated, client, meta, { viaDemo: true });
  }

  signInFailed() {
    return apiError(HttpStatus.UNAUTHORIZED, AUTH_ERROR_CODES.invalidCredentials, SIGN_IN_FAILED);
  }

  /**
   * Open a session. A half-signed-in one (two-factor still to do) ends after
   * AUTH_MFA_PENDING_MINUTES whatever happens; a full one follows the normal timeouts.
   */
  async openSession(
    user: User,
    kind: ClientKind,
    meta: RequestMeta,
    { stage = 'FULL', viaDemo = false }: { stage?: Session['stage']; viaDemo?: boolean } = {},
  ): Promise<Authenticated & { token: string }> {
    const token = newSessionToken();
    const client = kind === 'mobile' ? 'MOBILE' : 'WEB';
    const now = this.clock.now();
    const lifetime =
      stage === 'FULL'
        ? this.absoluteTimeoutMs(client)
        : this.env.AUTH_MFA_PENDING_MINUTES * MINUTE;
    const session = await this.prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: user.id,
        client,
        stage,
        viaDemo,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + lifetime),
        userAgent: meta.userAgent?.slice(0, 400) ?? null,
        ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
      },
    });
    return { user, session, token, freshFromPassword: stage !== 'FULL' };
  }

  /**
   * Who is calling. Runs on every request, so a leaver or an expired session is refused at once.
   * Throws 401 UNAUTHENTICATED (no or unknown session) or 401 SESSION_EXPIRED (timed out).
   */
  async authenticate(token: unknown): Promise<Authenticated> {
    if (!looksLikeSessionToken(token)) throw this.unauthenticated();
    const now = this.clock.now();
    const found = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });
    if (!found || found.revokedAt) throw this.unauthenticated();
    const { user, ...session } = found;

    if (user.status !== 'ACTIVE') {
      await this.revokeAllSessions(user.id, 'user_deactivated');
      throw this.unauthenticated();
    }

    // A session opened before the last password change is void, even one that raced the change
    // (signed in with the old password while the change was being saved).
    if (user.passwordChangedAt && session.createdAt < user.passwordChangedAt) {
      await this.prisma.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'password_changed' },
      });
      throw this.unauthenticated();
    }

    const idleEnd = session.lastSeenAt.getTime() + this.idleTimeoutMs(session.client);
    if (session.expiresAt <= now || idleEnd <= now.getTime()) {
      await this.prisma.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: session.expiresAt <= now ? 'expired' : 'idle_timeout',
        },
      });
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        AUTH_ERROR_CODES.sessionExpired,
        'Your session has ended. Please sign in again.',
      );
    }

    const freshFromPassword = session.stage !== 'FULL';
    // A role that must use two-factor but has not set it up is never fully signed in, even on a
    // session opened before that rule existed, or before the role changed. (Demo sessions are
    // the deliberate exception, A41.)
    if (
      session.stage === 'FULL' &&
      !session.viaDemo &&
      !user.totpEnabledAt &&
      roleRequiresMfa(roleKeySchema.parse(user.roleKey))
    ) {
      session.stage = 'MFA_SETUP';
    }

    if (now.getTime() - session.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
      await this.prisma.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { lastSeenAt: now },
      });
      session.lastSeenAt = now;
    }
    return { user, session, freshFromPassword };
  }

  unauthenticated() {
    return apiError(HttpStatus.UNAUTHORIZED, AUTH_ERROR_CODES.unauthenticated, 'Please sign in.');
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: this.clock.now(), revokedReason: 'signed_out' },
    });
  }

  /** Ends every open session of a user (leaver, password change, admin action). */
  async revokeAllSessions(
    userId: string,
    reason: string,
    exceptSessionId?: string,
  ): Promise<number> {
    const { count } = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: this.clock.now(), revokedReason: reason },
    });
    return count;
  }

  /**
   * Leaver: the account can no longer sign in and every open session ends now. The row stays
   * for the audit trail. (The admin screen and endpoint arrive in Phase 2c.)
   */
  async deactivateUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'DEACTIVATED', deactivatedAt: this.clock.now() },
    });
    await this.revokeAllSessions(userId, 'user_deactivated');
  }

  /**
   * Change your own password. A wrong current password counts towards the same lockout as
   * sign-in, so a stolen session cannot be used to guess the real password: when the tries run
   * out the account locks and every session ends. On success every session (including this one)
   * ends and a NEW session is opened, so the old token is worthless.
   */
  async changePassword(
    auth: Authenticated,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<Authenticated & { token: string }> {
    const { user, session } = auth;
    const now = this.clock.now();
    const reserved = await this.reserveAttempt(user.id, now);
    if (!reserved) {
      await this.revokeAllSessions(user.id, 'too_many_attempts');
      throw this.unauthenticated();
    }
    if (!(await this.verifyGated(currentPassword, user.passwordHash))) {
      if (await this.afterFailure(user.id, reserved.failedLoginCount, now)) {
        await this.revokeAllSessions(user.id, 'too_many_attempts');
        throw this.unauthenticated();
      }
      throw apiError(
        HttpStatus.BAD_REQUEST,
        AUTH_ERROR_CODES.wrongCurrentPassword,
        'Your current password is not right.',
      );
    }
    // The right current password: the reserved attempt does not count against them.
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0 } });

    const problems = checkPassword(newPassword, user);
    const messages = problems.map((p) => PASSWORD_PROBLEM_MESSAGES[p]);
    if (await this.verifyGated(newPassword, user.passwordHash)) {
      messages.push('Choose a password different from your current one.');
    }
    if (messages.length > 0) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        AUTH_ERROR_CODES.weakPassword,
        'Choose a stronger password.',
        messages,
      );
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword, this.env.PASSWORD_HASH_COST),
        passwordChangedAt: now,
        mustChangePassword: false,
      },
    });
    // Every device signed in as this person (another browser, a lost phone, this one) is signed
    // out; this device continues on a brand-new session.
    await this.revokeAllSessions(user.id, 'password_changed');
    // A new starter changes the temporary password first, then sets up two-factor on the new
    // session (so whoever issued the temporary password cannot enrol their own phone).
    return this.openSession(updated, session.client === 'MOBILE' ? 'mobile' : 'web', meta, {
      stage: session.stage === 'MFA_SETUP' ? 'MFA_SETUP' : 'FULL',
    });
  }

  /** Sign out the session a token belongs to, if any (signing in over an old session). */
  async revokeToken(token: unknown, reason: string): Promise<void> {
    if (!looksLikeSessionToken(token)) return;
    await this.prisma.session.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: this.clock.now(), revokedReason: reason },
    });
  }

  /** The user's sessions that are still usable, newest first. */
  async activeSessions(auth: Authenticated): Promise<DeviceSession[]> {
    const now = this.clock.now();
    const rows = await this.prisma.session.findMany({
      where: { userId: auth.user.id, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastSeenAt: 'desc' },
    });
    return rows
      .filter((s) => s.lastSeenAt.getTime() + this.idleTimeoutMs(s.client) > now.getTime())
      .map((s) => ({
        id: s.id,
        client: s.client === 'MOBILE' ? 'mobile' : 'web',
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        userAgent: s.userAgent,
        current: s.id === auth.session.id,
      }));
  }

  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: roleKeySchema.parse(user.roleKey),
      mustChangePassword: user.mustChangePassword,
      mfa: {
        enabled: user.totpEnabledAt !== null,
        required: roleRequiresMfa(roleKeySchema.parse(user.roleKey)),
      },
    };
  }

  sessionInfo(session: Session, freshFromPassword = false): SessionInfo {
    const idleMs = this.idleTimeoutMs(session.client);
    return {
      stage: STAGE_NAMES[session.stage],
      passwordConfirmNeeded: !freshFromPassword,
      idleExpiresAt: new Date(session.lastSeenAt.getTime() + idleMs).toISOString(),
      absoluteExpiresAt: session.expiresAt.toISOString(),
      idleTimeoutSeconds: Math.round(idleMs / 1000),
    };
  }
}
