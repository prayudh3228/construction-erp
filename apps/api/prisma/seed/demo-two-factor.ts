import { SecretBox } from '../../src/auth/secret-box';
import { type Seed } from './seeds';

/**
 * Turns on two-factor sign-in for the FAKE demo.admin account with a known demo secret
 * (DEMO_TOTP_SECRET), so the demo and the end-to-end tests can sign in with a real code.
 * demo.director and demo.finance stay without it, to show the "set up two-factor" step.
 */
export function demoTwoFactorSeed(): Seed {
  return {
    name: '0002-demo-two-factor',
    description: 'Two-factor sign-in on for demo.admin (demo secret).',
    async run(tx) {
      const secret = process.env.DEMO_TOTP_SECRET;
      const key = process.env.AUTH_ENCRYPTION_KEY;
      if (!secret || !key) {
        throw new Error('Set DEMO_TOTP_SECRET and AUTH_ENCRYPTION_KEY (see .env.example)');
      }
      await tx.user.update({
        where: { username: 'demo.admin' },
        data: { totpSecret: new SecretBox(key).encrypt(secret), totpEnabledAt: new Date() },
      });
    },
  };
}

/**
 * The way secrets are encrypted changed (separate derived keys, Phase 2b review): store the demo
 * secret again so databases seeded before the change can still decrypt it.
 */
export function demoTwoFactorRekeySeed(): Seed {
  return {
    ...demoTwoFactorSeed(),
    name: '0003-demo-two-factor-rekey',
    description: 'Re-encrypt the demo.admin secret with derived keys.',
  };
}
