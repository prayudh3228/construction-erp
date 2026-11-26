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
} from '@erp/shared';
import { isDemoUsername } from '@erp/shared/demo';
import { apiError } from '../common/api-error';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { type Session, type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CLOCK, type Clock } from './clock';
import { hashPassword, needsRehash, verifyPassword } from './password-hasher';
import { hashSessionToken, looksLikeSessionToken, newSessionToken } from './session-token';

export interface RequestMeta {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

export interface Authenticated {
  user: User;
  session: Session;
}

/** Same words for every sign-in failure, so the API never reveals which accounts exist. */
const SIGN_IN_FAILED =
  'Sign-in failed. Check your username and password. After several failed attempts the account is locked for a while.';

/** lastSeenAt is written at most once a minute per session, not on every request. */
const TOUCH_INTERVAL_MS = 60_000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

@Injectable()
export class AuthService {
  /** Hash of a random password, verified for unknown users so failures take the same time. */
  private dummyHash: Promise<string>;

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

  /** Check a username and password and open a session. Every failure looks the same. */
  async login(
    usernameInput: string,
    password: string,
    client: ClientKind,
    meta: RequestMeta,
  ): Promise<Authenticated & { token: string }> {
    const username = usernameInput.trim().toLowerCase();
    const now = this.clock.now();
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user) {
      await verifyPassword(password, await this.dummyHash);
      throw this.signInFailed();
    }

    // While locked, do not even check the password (and do not extend the lock).
    if (user.lockedUntil && user.lockedUntil > now) {
      await verifyPassword(password, await this.dummyHash);
      throw this.signInFailed();
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await this.recordFailure(user.id, now);
      throw this.signInFailed();
    }
    // Checked after the password, so a leaver's account answers exactly like a wrong password.
    if (user.status !== 'ACTIVE') throw this.signInFailed();

    const passwordHash = needsRehash(user.passwordHash, this.env.PASSWORD_HASH_COST)
      ? await hashPassword(password, this.env.PASSWORD_HASH_COST)
      : undefined;
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    return this.openSession(updated, client, meta);
  }

  /**
   * One-click sign-in for seeded demo accounts. Only when AUTH_DEMO_LOGIN=true, which the config
   * refuses in production; only for the fixed demo usernames; only for active accounts.
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
    return this.openSession(updated, client, meta);
  }

  private async recordFailure(userId: string, now: Date): Promise<void> {
    const { failedLoginCount } = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (failedLoginCount >= this.env.AUTH_MAX_FAILED_LOGINS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginCount: 0,
          lockedUntil: new Date(now.getTime() + this.env.AUTH_LOCKOUT_MINUTES * MINUTE),
        },
      });
    }
  }

  private signInFailed() {
    return apiError(HttpStatus.UNAUTHORIZED, AUTH_ERROR_CODES.invalidCredentials, SIGN_IN_FAILED);
  }

  private async openSession(user: User, kind: ClientKind, meta: RequestMeta) {
    const token = newSessionToken();
    const client = kind === 'mobile' ? 'MOBILE' : 'WEB';
    const now = this.clock.now();
    const session = await this.prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: user.id,
        client,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + this.absoluteTimeoutMs(client)),
        userAgent: meta.userAgent?.slice(0, 400) ?? null,
        ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
      },
    });
    return { user, session, token };
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

    if (now.getTime() - session.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
      await this.prisma.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { lastSeenAt: now },
      });
      session.lastSeenAt = now;
    }
    return { user, session };
  }

  private unauthenticated() {
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

  async changePassword(
    auth: Authenticated,
    currentPassword: string,
    newPassword: string,
  ): Promise<User> {
    const { user, session } = auth;
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        AUTH_ERROR_CODES.wrongCurrentPassword,
        'Your current password is not right.',
      );
    }
    const problems = checkPassword(newPassword, user);
    const messages = problems.map((p) => PASSWORD_PROBLEM_MESSAGES[p]);
    if (await verifyPassword(newPassword, user.passwordHash)) {
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
        passwordChangedAt: this.clock.now(),
        mustChangePassword: false,
      },
    });
    // Anyone else signed in as this person (another browser, a lost phone) is signed out.
    await this.revokeAllSessions(user.id, 'password_changed', session.id);
    return updated;
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
    };
  }

  sessionInfo(session: Session): SessionInfo {
    const idleMs = this.idleTimeoutMs(session.client);
    return {
      idleExpiresAt: new Date(session.lastSeenAt.getTime() + idleMs).toISOString(),
      absoluteExpiresAt: session.expiresAt.toISOString(),
      idleTimeoutSeconds: Math.round(idleMs / 1000),
    };
  }
}
