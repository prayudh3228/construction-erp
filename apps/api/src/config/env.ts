import { z } from 'zod';

/** "true"/"false" (also 1/0) from the environment, as a boolean. */
const booleanFlag = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

/** The published demo key (.env.example, Docker Compose, CI). Refused in production. */
export const DEMO_ENCRYPTION_KEY = 'MIBS9Ln91jpbLoWadi1S/81K/i8T+NFmcT3wZmRaQg4=';

/** Environment variables the API needs. Validated once at startup; the app refuses to boot if wrong. */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
        message: 'DATABASE_URL must be a postgres:// or postgresql:// URL',
      }),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    APP_VERSION: z.string().default('0.0.0'),

    // Sign-in and sessions. These become company settings in Phase 4; defaults are conservative.
    /** Web: signed out after this long without activity. */
    AUTH_IDLE_TIMEOUT_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .default(30),
    /** Web: signed out after this long however active (a working day). */
    AUTH_ABSOLUTE_TIMEOUT_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(7 * 24)
      .default(12),
    /** Phone: site staff work offline for days, so the idle limit is longer (A31). */
    AUTH_MOBILE_IDLE_TIMEOUT_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(60 * 24)
      .default(7 * 24),
    AUTH_MOBILE_ABSOLUTE_TIMEOUT_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** Failed sign-ins in a row before the account is locked for AUTH_LOCKOUT_MINUTES. */
    AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().min(3).max(20).default(5),
    AUTH_LOCKOUT_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .default(15),
    /** Failed sign-ins from one network address in AUTH_IP_WINDOW_MINUTES before it is refused. */
    AUTH_IP_MAX_FAILURES: z.coerce.number().int().min(5).max(10_000).default(30),
    AUTH_IP_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    /** Send the session cookie only over HTTPS. Defaults to on in production. */
    AUTH_COOKIE_SECURE: booleanFlag.optional(),
    /** One-click demo sign-in for the seeded demo accounts. Refused in production. */
    AUTH_DEMO_LOGIN: booleanFlag.default(false),
    /** scrypt cost as log2(N). 17 follows OWASP guidance; tests may lower it for speed. */
    PASSWORD_HASH_COST: z.coerce.number().int().min(10).max(20).default(17),
    /** Behind a reverse proxy (nginx in Docker): trust X-Forwarded-For for the client address. */
    TRUST_PROXY: booleanFlag.default(false),
    /**
     * 32 random bytes, base64. Encrypts authenticator secrets and keys the recovery-code hashes.
     * Losing it means everyone must set up two-factor again; leaking it weakens two-factor.
     */
    AUTH_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, {
      message: 'AUTH_ENCRYPTION_KEY must be 32 random bytes, base64-encoded',
    }),
    /** A half-signed-in session (password accepted, two-factor pending) lasts this long. */
    AUTH_MFA_PENDING_MINUTES: z.coerce.number().int().min(2).max(60).default(10),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.AUTH_DEMO_LOGIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_DEMO_LOGIN'],
        message: 'Demo sign-in must never be enabled in production',
      });
    }
    if (
      env.NODE_ENV === 'production' &&
      // Compare the key bytes, not the text: padding or spaces must not sneak the demo key in.
      Buffer.from(env.AUTH_ENCRYPTION_KEY, 'base64').equals(
        Buffer.from(DEMO_ENCRYPTION_KEY, 'base64'),
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_ENCRYPTION_KEY'],
        message: 'The demo key from .env.example must never be used in production',
      });
    }
    if (env.NODE_ENV === 'production' && env.PASSWORD_HASH_COST < 17) {
      ctx.addIssue({
        code: 'custom',
        path: ['PASSWORD_HASH_COST'],
        message: 'Use at least 17 in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

/** Whether the session cookie is HTTPS-only: the explicit setting, else on in production. */
export function cookieSecure(env: Env): boolean {
  return env.AUTH_COOKIE_SECURE ?? env.NODE_ENV === 'production';
}
