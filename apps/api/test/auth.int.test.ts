import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service';
import { hashPassword } from '../src/auth/password-hasher';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeClock, createTestApp } from './app';

const PREFIX = 'zz.auth.';
const PASSWORD = 'river stone lantern 47';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

let app: INestApplication;
let prisma: PrismaService;
let clock: FakeClock;
let seq = 0;

async function makeUser(
  extra: {
    roleKey?: string;
    status?: 'ACTIVE' | 'DEACTIVATED';
    mustChangePassword?: boolean;
    cost?: number;
  } = {},
) {
  seq += 1;
  const { cost = 12, ...rest } = extra;
  return prisma.user.create({
    data: {
      username: `${PREFIX}user${seq}`,
      email: `${PREFIX}user${seq}@example.com`,
      displayName: `Test User ${seq}`,
      passwordHash: await hashPassword(PASSWORD, cost),
      roleKey: 'site',
      ...rest,
    },
  });
}

const http = () => request(app.getHttpServer());

function login(username: string, password = PASSWORD, client: 'web' | 'mobile' = 'web') {
  return http().post('/api/auth/login').set('x-erp-client', client).send({ username, password });
}

/** Every Set-Cookie header of a response. */
function setCookies(res: request.Response): string[] {
  const value = res.headers['set-cookie'] as string[] | string | undefined;
  return value === undefined ? [] : ([] as string[]).concat(value);
}

/** The session cookie from a web sign-in, ready to send back. */
function sessionCookie(res: request.Response): string {
  const raw = setCookies(res);
  const cookie = raw.find((c) => c.startsWith('erp_session='));
  if (!cookie) throw new Error('no session cookie');
  return cookie.split(';')[0]!;
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
}

beforeAll(async () => {
  clock = new FakeClock();
  app = await createTestApp({ AUTH_DEMO_LOGIN: false }, { clock });
  prisma = app.get(PrismaService);
  await cleanup();
});

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await app.close();
});

describe('sign-in', () => {
  it('web: sets an httpOnly, SameSite=Lax cookie scoped to /api, and never returns the token', async () => {
    const user = await makeUser();
    const res = await login(user.username).expect(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toMatchObject({
      username: user.username,
      role: 'site',
      mustChangePassword: false,
    });
    const raw = setCookies(res).find((c) => c.startsWith('erp_session='))!;
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toMatch(/Path=\/api/);
    // The stored session holds only a hash of the token.
    const token = sessionCookie(res).split('=')[1]!;
    expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(0);

    const me = await http().get('/api/auth/me').set('Cookie', sessionCookie(res)).expect(200);
    expect(me.body.user.id).toBe(user.id);
  });

  it('mobile: returns a bearer token and sets no cookie', async () => {
    const user = await makeUser();
    const res = await login(user.username, PASSWORD, 'mobile').expect(200);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.headers['set-cookie']).toBeUndefined();
    await http().get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`).expect(200);
  });

  it('username is case-insensitive and trimmed; the password is exact', async () => {
    const user = await makeUser();
    await login(`  ${user.username.toUpperCase()} `).expect(200);
    await login(user.username, PASSWORD.toUpperCase()).expect(401);
    await login(user.username, ` ${PASSWORD}`).expect(401);
  });

  it('wrong password, unknown user and leaver all get the same answer', async () => {
    const user = await makeUser();
    const leaver = await makeUser({ status: 'DEACTIVATED' });
    const answers = await Promise.all([
      login(user.username, 'wrong password here'),
      login(`${PREFIX}nobody`),
      login(leaver.username),
    ]);
    for (const res of answers) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    }
    expect(new Set(answers.map((r) => r.body.message)).size).toBe(1);
  });

  it('refuses a write without the x-erp-client header (CSRF defence)', async () => {
    const user = await makeUser();
    const res = await http()
      .post('/api/auth/login')
      .send({ username: user.username, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CLIENT_HEADER_MISSING');
  });

  it('rejects a malformed body with readable details', async () => {
    const res = await http()
      .post('/api/auth/login')
      .set('x-erp-client', 'web')
      .send({ username: '' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('accepts the email address instead of the username', async () => {
    const user = await makeUser();
    const res = await login(` ${user.email!.toUpperCase()} `).expect(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it('signing in over an existing session ends the old one on the server (shared PC)', async () => {
    const first = await makeUser();
    const second = await makeUser();
    const old = sessionCookie(await login(first.username).expect(200));
    await http()
      .post('/api/auth/login')
      .set('x-erp-client', 'web')
      .set('Cookie', old)
      .send({ username: second.username, password: PASSWORD })
      .expect(200);
    await http().get('/api/auth/me').set('Cookie', old).expect(401);
  });

  it('upgrades an old password hash at the next successful sign-in', async () => {
    const user = await makeUser({ cost: 11 });
    await login(user.username).expect(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.passwordHash.startsWith('scrypt$12$')).toBe(true);
    await login(user.username).expect(200); // still the same password
  });
});

describe('lockout', () => {
  it('locks after 5 wrong passwords, refuses even the right one, unlocks after 15 minutes', async () => {
    const user = await makeUser();
    for (let i = 0; i < 5; i++) await login(user.username, 'wrong password here').expect(401);
    const locked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(locked.lockedUntil?.getTime()).toBe(clock.now().getTime() + 15 * MINUTE);

    await login(user.username).expect(401);
    clock.advance(14 * MINUTE);
    await login(user.username).expect(401);
    clock.advance(1 * MINUTE + 1);
    await login(user.username).expect(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
  });

  it('a successful sign-in resets the count, so failures must be in a row', async () => {
    const user = await makeUser();
    for (let i = 0; i < 4; i++) await login(user.username, 'wrong password here').expect(401);
    await login(user.username).expect(200);
    for (let i = 0; i < 4; i++) await login(user.username, 'wrong password here').expect(401);
    await login(user.username).expect(200);
  });

  it('every try is reserved before the password check: none left means no check at all', async () => {
    // As if 5 attempts were in flight right now: even the right password must be refused.
    const user = await makeUser();
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 5 } });
    await login(user.username).expect(401);
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 4 } });
    await login(user.username).expect(200);
  });

  it('a parallel burst gets at most 5 password checks, so a correct guess in it cannot win', async () => {
    const user = await makeUser();
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 4 } });
    // One try left: of 10 parallel requests (9 wrong, 1 right) only the first to reserve is checked.
    const results = await Promise.all([
      ...Array.from({ length: 9 }, () => login(user.username, 'wrong password here')),
      login(user.username),
    ]);
    const successes = results.filter((r) => r.status === 200).length;
    expect(successes).toBeLessThanOrEqual(1);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    // Either the right one won (count reset) or a wrong one used the last try (locked).
    expect(successes === 1 ? after.failedLoginCount === 0 : after.lockedUntil !== null).toBe(true);
  });

  it('parallel wrong attempts still lock the account', async () => {
    const user = await makeUser();
    await Promise.all(Array.from({ length: 8 }, () => login(user.username, 'wrong password here')));
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.lockedUntil).not.toBeNull();
    await login(user.username).expect(401);
  });
});

describe('sessions and timeouts', () => {
  it('web: ends after 30 minutes without activity', async () => {
    const user = await makeUser();
    const cookie = sessionCookie(await login(user.username).expect(200));
    clock.advance(29 * MINUTE);
    await http().get('/api/auth/me').set('Cookie', cookie).expect(200);
    clock.advance(30 * MINUTE + 1);
    const res = await http().get('/api/auth/me').set('Cookie', cookie).expect(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.revokedReason).toBe('idle_timeout');
    // Once ended it stays ended.
    expect((await http().get('/api/auth/me').set('Cookie', cookie)).body.code).toBe(
      'UNAUTHENTICATED',
    );
  });

  it('web: activity keeps it alive, but never beyond 12 hours', async () => {
    const user = await makeUser();
    const cookie = sessionCookie(await login(user.username).expect(200));
    for (let t = 20; t < 12 * 60; t += 20) {
      clock.advance(20 * MINUTE);
      await http().get('/api/auth/me').set('Cookie', cookie).expect(200);
    }
    clock.advance(20 * MINUTE); // now at 12 h
    const res = await http().get('/api/auth/me').set('Cookie', cookie).expect(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
  });

  it('reports when the session will end, so the web app can warn first', async () => {
    const user = await makeUser();
    const res = await login(user.username).expect(200);
    const start = clock.now().getTime();
    expect(res.body.session).toEqual({
      stage: 'full',
      idleExpiresAt: new Date(start + 30 * MINUTE).toISOString(),
      absoluteExpiresAt: new Date(start + 12 * HOUR).toISOString(),
      idleTimeoutSeconds: 30 * 60,
    });
  });

  it('mobile: allows 7 days offline before the idle limit', async () => {
    const user = await makeUser();
    const { token } = (await login(user.username, PASSWORD, 'mobile').expect(200)).body;
    clock.advance(6 * 24 * HOUR);
    await http().get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    clock.advance(7 * 24 * HOUR + 1);
    await http().get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('sign-out ends this session only and clears the cookie', async () => {
    const user = await makeUser();
    const a = sessionCookie(await login(user.username).expect(200));
    const b = sessionCookie(await login(user.username).expect(200));
    const res = await http()
      .post('/api/auth/logout')
      .set('x-erp-client', 'web')
      .set('Cookie', a)
      .expect(204);
    expect(setCookies(res).join()).toMatch(/erp_session=;/);
    await http().get('/api/auth/me').set('Cookie', a).expect(401);
    await http().get('/api/auth/me').set('Cookie', b).expect(200);
  });

  it('lists your signed-in devices, marking this one', async () => {
    const user = await makeUser();
    const web = sessionCookie(await login(user.username).expect(200));
    await login(user.username, PASSWORD, 'mobile').expect(200);
    const res = await http().get('/api/auth/sessions').set('Cookie', web).expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    expect(res.body.map((s: { client: string }) => s.client).sort()).toEqual(['mobile', 'web']);
  });

  it('every non-public route needs a session; garbage tokens are refused', async () => {
    await http().get('/api/auth/me').expect(401);
    await http().get('/api/auth/sessions').set('Authorization', 'Bearer not-a-token').expect(401);
    await http()
      .get('/api/auth/me')
      .set('Cookie', `erp_session=${'a'.repeat(43)}`)
      .expect(401);
    await http().get('/api/health').expect(200); // public
  });
});

describe('leavers', () => {
  it('deactivation ends every open session at once and blocks sign-in', async () => {
    const user = await makeUser();
    const web = sessionCookie(await login(user.username).expect(200));
    const { token } = (await login(user.username, PASSWORD, 'mobile').expect(200)).body;

    await app.get(AuthService).deactivateUser(user.id);

    await http().get('/api/auth/me').set('Cookie', web).expect(401);
    await http().get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    await login(user.username).expect(401);
    const open = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(open).toBe(0);
  });

  it('a session is refused even if the status changed without revoking it', async () => {
    const user = await makeUser();
    const web = sessionCookie(await login(user.username).expect(200));
    await prisma.user.update({ where: { id: user.id }, data: { status: 'DEACTIVATED' } });
    await http().get('/api/auth/me').set('Cookie', web).expect(401);
  });
});

describe('password change', () => {
  async function signedIn(extra: Parameters<typeof makeUser>[0] = {}) {
    const user = await makeUser(extra);
    const cookie = sessionCookie(await login(user.username).expect(200));
    const change = (currentPassword: string, newPassword: string) =>
      http()
        .post('/api/auth/change-password')
        .set('x-erp-client', 'web')
        .set('Cookie', cookie)
        .send({ currentPassword, newPassword });
    return { user, cookie, change };
  }

  it('needs the current password', async () => {
    const { change } = await signedIn();
    const res = await change('not my password', 'brand new lantern 58').expect(400);
    expect(res.body.code).toBe('WRONG_CURRENT_PASSWORD');
  });

  it('applies the password rules and lists every problem', async () => {
    const { user, change } = await signedIn();
    const short = await change(PASSWORD, 'short').expect(400);
    expect(short.body.code).toBe('WEAK_PASSWORD');
    expect(short.body.details.join(' ')).toMatch(/at least 12/);
    const personal = await change(PASSWORD, `${user.username} lantern`).expect(400);
    expect(personal.body.details.join(' ')).toMatch(/name, username or email/);
    const same = await change(PASSWORD, PASSWORD).expect(400);
    expect(same.body.details.join(' ')).toMatch(/different from your current/);
  });

  it('works: every old session ends, this device continues on a NEW session', async () => {
    const { user, cookie, change } = await signedIn();
    const other = sessionCookie(await login(user.username).expect(200));
    const res = await change(PASSWORD, 'brand new lantern 58').expect(200);
    const fresh = sessionCookie(res);
    expect(fresh).not.toBe(cookie);
    await http().get('/api/auth/me').set('Cookie', fresh).expect(200);
    // The token used to make the change is worthless now (no session fixation).
    await http().get('/api/auth/me').set('Cookie', cookie).expect(401);
    await http().get('/api/auth/me').set('Cookie', other).expect(401);
    await login(user.username).expect(401);
    await login(user.username, 'brand new lantern 58').expect(200);
  });

  it('mobile gets its new token in the answer', async () => {
    const user = await makeUser();
    const { token } = (await login(user.username, PASSWORD, 'mobile').expect(200)).body;
    const res = await http()
      .post('/api/auth/change-password')
      .set('x-erp-client', 'mobile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'brand new lantern 58' })
      .expect(200);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.token).not.toBe(token);
    await http().get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`).expect(200);
    await http().get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('wrong current passwords count towards the lockout; at the limit every session ends', async () => {
    const { user, cookie, change } = await signedIn();
    for (let i = 0; i < 4; i++) {
      const res = await change('not my password', 'brand new lantern 58');
      expect(res.body.code).toBe('WRONG_CURRENT_PASSWORD');
    }
    // The 5th wrong guess locks the account and ends the (possibly stolen) session.
    await change('not my password', 'brand new lantern 58').expect(401);
    await http().get('/api/auth/me').set('Cookie', cookie).expect(401);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.lockedUntil).not.toBeNull();
    await login(user.username).expect(401);
  });

  it('a session opened before the last password change is void (sign-in racing a change)', async () => {
    const user = await makeUser();
    const cookie = sessionCookie(await login(user.username).expect(200));
    // As if the password changed after this session was created, without revoking it.
    clock.advance(1000);
    await prisma.user.update({ where: { id: user.id }, data: { passwordChangedAt: clock.now() } });
    await http().get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  it('a user who must change their password can do only that until they do', async () => {
    const { cookie, change } = await signedIn({ mustChangePassword: true });
    const me = await http().get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.user.mustChangePassword).toBe(true);
    const blocked = await http().get('/api/auth/sessions').set('Cookie', cookie).expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const changed = await change(PASSWORD, 'brand new lantern 58').expect(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    await http().get('/api/auth/sessions').set('Cookie', sessionCookie(changed)).expect(200);
  });
});

describe('per-address throttling', () => {
  it('a source that keeps failing is refused before any password check, even with the right one', async () => {
    const strict = await createTestApp({ AUTH_IP_MAX_FAILURES: 5, AUTH_MAX_FAILED_LOGINS: 20 });
    try {
      const user = await makeUser();
      const attempt = (password: string) =>
        request(strict.getHttpServer())
          .post('/api/auth/login')
          .set('x-erp-client', 'web')
          .send({ username: user.username, password });
      // Made-up usernames count too (they never lock an account, so they must count here).
      for (let i = 0; i < 5; i++) {
        await request(strict.getHttpServer())
          .post('/api/auth/login')
          .set('x-erp-client', 'web')
          .send({ username: `${PREFIX}ghost${i}`, password: 'x' })
          .expect(401);
      }
      const res = await attempt(PASSWORD).expect(429);
      expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
    } finally {
      await strict.close();
    }
  });

  it('successful sign-ins do not count, so an office on one address is never blocked', async () => {
    const strict = await createTestApp({ AUTH_IP_MAX_FAILURES: 5 });
    try {
      const user = await makeUser();
      for (let i = 0; i < 8; i++) {
        await request(strict.getHttpServer())
          .post('/api/auth/login')
          .set('x-erp-client', 'web')
          .send({ username: user.username, password: PASSWORD })
          .expect(200);
      }
    } finally {
      await strict.close();
    }
  });
});

describe('demo sign-in', () => {
  it('is refused unless AUTH_DEMO_LOGIN is on', async () => {
    const res = await http()
      .post('/api/auth/demo-login')
      .set('x-erp-client', 'web')
      .send({ username: 'demo.director' })
      .expect(403);
    expect(res.body.code).toBe('DEMO_LOGIN_DISABLED');
  });

  it('when on, works only for the fixed demo usernames', async () => {
    const demoApp = await createTestApp({ AUTH_DEMO_LOGIN: true });
    const demoPrisma = demoApp.get(PrismaService);
    // Use a seeded demo.site if there is one; otherwise create it and remove it afterwards.
    const existed = await demoPrisma.user.findUnique({ where: { username: 'demo.site' } });
    if (!existed) {
      await demoPrisma.user.create({
        data: {
          username: 'demo.site',
          displayName: 'Demo Site Engineer',
          passwordHash: await hashPassword(PASSWORD, 12),
          roleKey: 'site',
        },
      });
    }
    try {
      const ok = await request(demoApp.getHttpServer())
        .post('/api/auth/demo-login')
        .set('x-erp-client', 'web')
        .send({ username: 'demo.site' })
        .expect(200);
      expect(ok.body.user.username).toBe('demo.site');

      const user = await makeUser();
      await request(demoApp.getHttpServer())
        .post('/api/auth/demo-login')
        .set('x-erp-client', 'web')
        .send({ username: user.username })
        .expect(401);
    } finally {
      if (!existed) await demoPrisma.user.delete({ where: { username: 'demo.site' } });
      await demoApp.close();
    }
  });
});
