import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../src/auth/password-hasher';
import { SecretBox } from '../src/auth/secret-box';
import { totpCode, totpStep } from '../src/auth/totp';
import { loadEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeClock, createTestApp } from './app';

const PREFIX = 'zz.mfa.';
const PASSWORD = 'river stone lantern 47';
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const MINUTE = 60_000;

let app: INestApplication;
let prisma: PrismaService;
let clock: FakeClock;
let seq = 0;
const box = new SecretBox(loadEnv().AUTH_ENCRYPTION_KEY);
const http = () => request(app.getHttpServer());

/** The code an authenticator app shows right now (by the test clock), or a step later. */
const codeNow = (secret = SECRET, stepsAhead = 0) =>
  totpCode(secret, totpStep(clock.now()) + stepsAhead);

async function makeUser(opts: { role?: string; mfa?: boolean } = {}) {
  seq += 1;
  return prisma.user.create({
    data: {
      username: `${PREFIX}user${seq}`,
      displayName: `MFA User ${seq}`,
      passwordHash: await hashPassword(PASSWORD, 12),
      roleKey: opts.role ?? 'site',
      ...(opts.mfa ? { totpSecret: box.encrypt(SECRET), totpEnabledAt: clock.now() } : {}),
    },
  });
}

function cookieOf(res: request.Response): string {
  const value = res.headers['set-cookie'] as string[] | string | undefined;
  const all = value === undefined ? [] : ([] as string[]).concat(value);
  const c = all.find((x) => x.startsWith('erp_session=') && !x.startsWith('erp_session=;'));
  if (!c) throw new Error('no session cookie');
  return c.split(';')[0]!;
}

const login = (username: string, client: 'web' | 'mobile' = 'web') =>
  http().post('/api/auth/login').set('x-erp-client', client).send({ username, password: PASSWORD });

const post = (path: string, cookie: string, body: object = {}) =>
  http().post(`/api/auth${path}`).set('x-erp-client', 'web').set('Cookie', cookie).send(body);

beforeAll(async () => {
  clock = new FakeClock();
  app = await createTestApp({ AUTH_DEMO_LOGIN: false }, { clock });
  prisma = app.get(PrismaService);
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  // Every test starts in a fresh 30-second step, so codes from one test never clash.
  clock.advance(60_000);
});

afterAll(async () => {
  await app.close();
});

describe('which sign-ins need two-factor', () => {
  it('a role that does not require it and has it off: signed in at once', async () => {
    const user = await makeUser({ role: 'site' });
    const res = await login(user.username).expect(200);
    expect(res.body.session.stage).toBe('full');
    expect(res.body.user.mfa).toEqual({ enabled: false, required: false });
  });

  it('Admin, Director and Finance without it set up: must set it up before anything else', async () => {
    for (const role of ['admin', 'director', 'finance']) {
      const user = await makeUser({ role });
      const res = await login(user.username).expect(200);
      expect(res.body.session.stage).toBe('mfa_setup');
      expect(res.body.user.mfa.required).toBe(true);
      const blocked = await http()
        .get('/api/auth/sessions')
        .set('Cookie', cookieOf(res))
        .expect(403);
      expect(blocked.body.code).toBe('MFA_REQUIRED');
    }
  });

  it('anyone with it on must enter a code', async () => {
    const user = await makeUser({ role: 'site', mfa: true });
    const res = await login(user.username).expect(200);
    expect(res.body.session.stage).toBe('mfa_verify');
    await http().get('/api/auth/sessions').set('Cookie', cookieOf(res)).expect(403);
    // Who am I and sign out still work while half signed in.
    await http().get('/api/auth/me').set('Cookie', cookieOf(res)).expect(200);
    await post('/logout', cookieOf(res)).expect(204);
  });

  it('a half-signed-in session ends after 10 minutes', async () => {
    const user = await makeUser({ mfa: true });
    const cookie = cookieOf(await login(user.username).expect(200));
    clock.advance(10 * MINUTE + 1);
    const res = await http().get('/api/auth/me').set('Cookie', cookie).expect(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
  });
});

describe('setting up', () => {
  async function pendingSetup() {
    const user = await makeUser({ role: 'finance' });
    const cookie = cookieOf(await login(user.username).expect(200));
    const setup = await post('/mfa/setup', cookie).expect(200);
    return {
      user,
      cookie,
      secret: setup.body.secret as string,
      uri: setup.body.otpauthUri as string,
    };
  }

  it('gives a secret and an otpauth link; the stored secret is encrypted and not yet active', async () => {
    const { user, secret, uri } = await pendingSetup();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain(encodeURIComponent(user.username));
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.totpSecret).toMatch(/^v1:/);
    expect(row.totpSecret).not.toContain(secret);
    expect(row.totpEnabledAt).toBeNull();
  });

  it('a wrong code does not switch it on', async () => {
    const { cookie } = await pendingSetup();
    const res = await post('/mfa/enable', cookie, { code: '000000' }).expect(400);
    expect(res.body.code).toBe('INVALID_MFA_CODE');
  });

  it('the right code switches it on, returns 10 recovery codes once, and signs in on a new session', async () => {
    const { user, cookie, secret } = await pendingSetup();
    const res = await post('/mfa/enable', cookie, { code: codeNow(secret) }).expect(200);
    expect(res.body.session.stage).toBe('full');
    expect(res.body.user.mfa).toEqual({ enabled: true, required: true });
    expect(res.body.recoveryCodes).toHaveLength(10);
    const fresh = cookieOf(res);
    expect(fresh).not.toBe(cookie);
    await http().get('/api/auth/sessions').set('Cookie', fresh).expect(200);
    await http().get('/api/auth/me').set('Cookie', cookie).expect(401); // pending one is gone
    // Only hashes are stored.
    const stored = await prisma.recoveryCode.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(10);
    for (const c of res.body.recoveryCodes as string[]) {
      expect(stored.some((s) => s.codeHash.includes(c))).toBe(false);
    }
  });

  it('enable before setup is refused with a clear reason', async () => {
    const user = await makeUser({ role: 'finance' });
    const cookie = cookieOf(await login(user.username).expect(200));
    const res = await post('/mfa/enable', cookie, { code: '123456' }).expect(400);
    expect(res.body.code).toBe('MFA_SETUP_NOT_STARTED');
  });

  it('a session waiting for a code cannot start a new setup (cannot swap the secret)', async () => {
    const user = await makeUser({ mfa: true });
    const cookie = cookieOf(await login(user.username).expect(200));
    await post('/mfa/setup', cookie).expect(409);
  });
});

describe('the second step of sign-in', () => {
  it('the right code signs in on a new session; the half-signed-in token is worthless', async () => {
    const user = await makeUser({ mfa: true });
    const pending = cookieOf(await login(user.username).expect(200));
    const res = await post('/mfa/verify', pending, { code: codeNow() }).expect(200);
    expect(res.body.session.stage).toBe('full');
    const full = cookieOf(res);
    expect(full).not.toBe(pending);
    await http().get('/api/auth/sessions').set('Cookie', full).expect(200);
    await http().get('/api/auth/me').set('Cookie', pending).expect(401);
  });

  it('a code works once: the same code is refused on the next sign-in', async () => {
    const user = await makeUser({ mfa: true });
    const code = codeNow();
    await post('/mfa/verify', cookieOf(await login(user.username)), { code }).expect(200);
    const again = await post('/mfa/verify', cookieOf(await login(user.username)), { code }).expect(
      400,
    );
    expect(again.body.code).toBe('INVALID_MFA_CODE');
    // The next 30-second code works.
    clock.advance(30_000);
    await post('/mfa/verify', cookieOf(await login(user.username)), { code: codeNow() }).expect(
      200,
    );
  });

  it('the same code sent twice at once passes only once', async () => {
    const user = await makeUser({ mfa: true });
    const a = cookieOf(await login(user.username));
    const b = cookieOf(await login(user.username));
    const code = codeNow();
    const results = await Promise.all([
      post('/mfa/verify', a, { code }),
      post('/mfa/verify', b, { code }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('a recovery code works exactly once, in any case, with or without the dash', async () => {
    const user = await makeUser({ mfa: true });
    const codes = ['ABCDE-FGHJK', 'MNPQR-STUVW'];
    await prisma.recoveryCode.createMany({
      data: codes.map((c) => ({ userId: user.id, codeHash: box.hash(c) })),
    });
    await post('/mfa/verify', cookieOf(await login(user.username)), {
      recoveryCode: ' abcde fghjk ',
    }).expect(200);
    const reused = await post('/mfa/verify', cookieOf(await login(user.username)), {
      recoveryCode: 'ABCDEFGHJK',
    }).expect(400);
    expect(reused.body.code).toBe('INVALID_MFA_CODE');
    const full = cookieOf(
      await post('/mfa/verify', cookieOf(await login(user.username)), {
        recoveryCode: 'MNPQR-STUVW',
      }),
    );
    const status = await http().get('/api/auth/mfa').set('Cookie', full).expect(200);
    expect(status.body).toEqual({ enabled: true, required: false, recoveryCodesLeft: 0 });
  });

  it('wrong codes count towards the lockout; at the limit the account locks and the session ends', async () => {
    const user = await makeUser({ mfa: true });
    const cookie = cookieOf(await login(user.username)); // 1 reserved try, reset on success
    for (let i = 0; i < 4; i++) await post('/mfa/verify', cookie, { code: '000000' }).expect(400);
    await post('/mfa/verify', cookie, { code: '000000' }).expect(401);
    await http().get('/api/auth/me').set('Cookie', cookie).expect(401);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.lockedUntil).not.toBeNull();
    await login(user.username).expect(401);
  });

  it('mobile gets its full-session token in the answer', async () => {
    const user = await makeUser({ mfa: true });
    const { token } = (await login(user.username, 'mobile').expect(200)).body;
    const res = await http()
      .post('/api/auth/mfa/verify')
      .set('x-erp-client', 'mobile')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: codeNow() })
      .expect(200);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.token).not.toBe(token);
  });

  it('a session that is already fully signed in has no code to enter', async () => {
    const user = await makeUser();
    const cookie = cookieOf(await login(user.username));
    await post('/mfa/verify', cookie, { code: '123456' }).expect(409);
  });
});

describe('managing two-factor when signed in', () => {
  async function fullySignedIn(role = 'site') {
    const user = await makeUser({ role, mfa: true });
    const res = await post('/mfa/verify', cookieOf(await login(user.username)), {
      code: codeNow(),
    });
    clock.advance(30_000); // so the next action can use a fresh code
    return { user, cookie: cookieOf(res) };
  }

  it('new recovery codes need an app code, and the old ones stop working', async () => {
    const { user, cookie } = await fullySignedIn();
    await prisma.recoveryCode.create({
      data: { userId: user.id, codeHash: box.hash('ABCDE-FGHJK') },
    });
    await post('/mfa/recovery-codes', cookie, { code: '000000' }).expect(400);
    const res = await post('/mfa/recovery-codes', cookie, { code: codeNow() }).expect(200);
    expect(res.body.recoveryCodes).toHaveLength(10);
    const old = await prisma.recoveryCode.count({
      where: { userId: user.id, codeHash: box.hash('ABCDE-FGHJK') },
    });
    expect(old).toBe(0);
  });

  it('a role that must use it cannot switch it off', async () => {
    const { cookie } = await fullySignedIn('finance');
    const res = await post('/mfa/disable', cookie, { code: codeNow() }).expect(403);
    expect(res.body.code).toBe('MFA_CANNOT_DISABLE');
  });

  it('other roles can switch it off with a code; the next sign-in needs no code', async () => {
    const { user, cookie } = await fullySignedIn('site');
    const res = await post('/mfa/disable', cookie, { code: codeNow() }).expect(200);
    expect(res.body.user.mfa.enabled).toBe(false);
    expect((await login(user.username)).body.session.stage).toBe('full');
  });

  it('a user without it can switch it on from a full session', async () => {
    const user = await makeUser({ role: 'site' });
    const cookie = cookieOf(await login(user.username));
    const setup = await post('/mfa/setup', cookie).expect(200);
    const res = await post('/mfa/enable', cookie, { code: codeNow(setup.body.secret) }).expect(200);
    expect(res.body.user.mfa.enabled).toBe(true);
    expect((await login(user.username)).body.session.stage).toBe('mfa_verify');
  });
});

describe('demo sign-in', () => {
  it('skips two-factor on purpose (local demo only)', async () => {
    const demoApp = await createTestApp({ AUTH_DEMO_LOGIN: true });
    const demoPrisma = demoApp.get(PrismaService);
    const existed = await demoPrisma.user.findUnique({ where: { username: 'demo.director' } });
    if (!existed) {
      await demoPrisma.user.create({
        data: {
          username: 'demo.director',
          displayName: 'Demo Director',
          passwordHash: await hashPassword(PASSWORD, 12),
          roleKey: 'director',
        },
      });
    }
    try {
      const res = await request(demoApp.getHttpServer())
        .post('/api/auth/demo-login')
        .set('x-erp-client', 'web')
        .send({ username: 'demo.director' })
        .expect(200);
      expect(res.body.session.stage).toBe('full');
    } finally {
      if (!existed) await demoPrisma.user.delete({ where: { username: 'demo.director' } });
      await demoApp.close();
    }
  });
});
