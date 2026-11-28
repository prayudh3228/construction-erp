import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from './password-policy.js';
import { roleKeySchema } from './roles.js';

/** Header every state-changing request must send (CSRF defence for cookie sessions). */
export const CLIENT_HEADER = 'x-erp-client';
export const CLIENT_KINDS = ['web', 'mobile'] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

/** Name of the web session cookie (httpOnly; the browser never reads it). */
export const SESSION_COOKIE = 'erp_session';

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z
    .string()
    .min(1)
    .max(PASSWORD_MAX_LENGTH * 4),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(1, 'Enter a new password.'),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

/** The signed-in user as the API reports it (GET /api/auth/me). */
export const authUserSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  role: roleKeySchema,
  mustChangePassword: z.boolean(),
  mfa: z.object({
    /** Two-factor sign-in is switched on for this user. */
    enabled: z.boolean(),
    /** The user's role must use two-factor sign-in (it cannot be switched off). */
    required: z.boolean(),
  }),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * full: signed in. mfa_verify: password accepted, enter an authenticator or recovery code.
 * mfa_setup: password accepted, but two-factor must be set up before anything else.
 */
export const SESSION_STAGES = ['full', 'mfa_verify', 'mfa_setup'] as const;
export type SessionStage = (typeof SESSION_STAGES)[number];

export const sessionInfoSchema = z.object({
  stage: z.enum(SESSION_STAGES),
  /** ISO instants. The session ends at whichever comes first. */
  idleExpiresAt: z.string(),
  absoluteExpiresAt: z.string(),
  idleTimeoutSeconds: z.number().int().positive(),
});
export type SessionInfo = z.infer<typeof sessionInfoSchema>;

export const meResponseSchema = z.object({ user: authUserSchema, session: sessionInfoSchema });
export type MeResponse = z.infer<typeof meResponseSchema>;

/** One signed-in device of the current user (GET /api/auth/sessions). */
export const deviceSessionSchema = z.object({
  id: z.uuid(),
  client: z.enum(['web', 'mobile']),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  userAgent: z.string().nullable(),
  current: z.boolean(),
});
export type DeviceSession = z.infer<typeof deviceSessionSchema>;

/** Mobile clients get the token in the body; web clients get it only as an httpOnly cookie. */
export const loginResponseSchema = meResponseSchema.extend({ token: z.string().optional() });
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** POST /api/auth/mfa/verify: an authenticator code, or one recovery code. */
export const mfaVerifyRequestSchema = z.union([
  z.object({ code: z.string().trim().min(1, 'Enter the 6-digit code.').max(20) }).strict(),
  z.object({ recoveryCode: z.string().trim().min(1, 'Enter a recovery code.').max(40) }).strict(),
]);
export type MfaVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;

/** POST /api/auth/mfa/setup: a new secret to add to the authenticator app (not yet active). */
export const mfaSetupResponseSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
});
export type MfaSetupResponse = z.infer<typeof mfaSetupResponseSchema>;

/**
 * A code from the authenticator app to confirm setup. `password` is needed when setting up from
 * an already signed-in session (not straight after entering it at sign-in).
 */
export const mfaCodeRequestSchema = z.object({
  code: z.string().trim().min(1, 'Enter the 6-digit code.').max(20),
  password: z
    .string()
    .min(1)
    .max(PASSWORD_MAX_LENGTH * 4)
    .optional(),
});

/** Changing two-factor (new recovery codes, switching off) needs the password and an app code. */
export const mfaConfirmRequestSchema = z.object({
  code: z.string().trim().min(1, 'Enter the 6-digit code.').max(20),
  password: z
    .string()
    .min(1, 'Enter your password.')
    .max(PASSWORD_MAX_LENGTH * 4),
});

/** Shown once, right after they are made. Only hashes are stored. */
export const recoveryCodesResponseSchema = z.object({ recoveryCodes: z.array(z.string()) });

/** POST /api/auth/mfa/enable: two-factor is on; the session is fully signed in. */
export const mfaEnableResponseSchema = loginResponseSchema.extend({
  recoveryCodes: z.array(z.string()),
});
export type MfaEnableResponse = z.infer<typeof mfaEnableResponseSchema>;

export const mfaStatusSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
  recoveryCodesLeft: z.number().int().nonnegative(),
});
export type MfaStatus = z.infer<typeof mfaStatusSchema>;

/** Machine-readable error codes the clients react to. */
export const AUTH_ERROR_CODES = {
  invalidCredentials: 'INVALID_CREDENTIALS',
  unauthenticated: 'UNAUTHENTICATED',
  sessionExpired: 'SESSION_EXPIRED',
  passwordChangeRequired: 'PASSWORD_CHANGE_REQUIRED',
  weakPassword: 'WEAK_PASSWORD',
  wrongCurrentPassword: 'WRONG_CURRENT_PASSWORD',
  clientHeaderMissing: 'CLIENT_HEADER_MISSING',
  demoLoginDisabled: 'DEMO_LOGIN_DISABLED',
  tooManyAttempts: 'TOO_MANY_ATTEMPTS',
  mfaRequired: 'MFA_REQUIRED',
  invalidMfaCode: 'INVALID_MFA_CODE',
  mfaSetupNotStarted: 'MFA_SETUP_NOT_STARTED',
  mfaCannotDisable: 'MFA_CANNOT_DISABLE',
  serverBusy: 'SERVER_BUSY',
} as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

/** Error body shape for every API error the clients show to people. */
export const apiErrorSchema = z.object({
  statusCode: z.number(),
  code: z.string(),
  message: z.string(),
  details: z.array(z.string()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
