import { DEMO_ACCOUNTS } from '@erp/shared/demo';
import { hashPassword } from '../../src/auth/password-hasher';
import { type Seed } from './seeds';

/**
 * FAKE demo users for local review, one per role, plus a new starter who must change their
 * password and a leaver who can no longer sign in. Their password comes from DEMO_USER_PASSWORD
 * (a local demo value, see .env.example), never from code. Seeding refuses to run in production.
 */
export function demoUsersSeed(): Seed {
  return {
    name: '0001-demo-users',
    description: 'Demo users: one per role, a new starter and a leaver.',
    async run(tx) {
      const password = process.env.DEMO_USER_PASSWORD;
      if (!password)
        throw new Error('Set DEMO_USER_PASSWORD (see .env.example) to seed demo users');
      const cost = Number(process.env.PASSWORD_HASH_COST ?? 17);
      const passwordHash = await hashPassword(password, cost);
      const now = new Date();
      const users = [
        ...DEMO_ACCOUNTS.map((a) => ({
          username: a.username,
          displayName: a.displayName,
          roleKey: a.role,
        })),
        {
          username: 'demo.newstarter',
          displayName: 'Demo New Starter',
          roleKey: 'site',
          mustChangePassword: true,
        },
        {
          username: 'demo.leaver',
          displayName: 'Demo Leaver',
          roleKey: 'purchase',
          status: 'DEACTIVATED' as const,
          deactivatedAt: now,
        },
      ];
      for (const u of users) {
        await tx.user.create({
          data: {
            email: `${u.username}@example.com`,
            passwordHash,
            passwordChangedAt: now,
            ...u,
          },
        });
      }
    },
  };
}
