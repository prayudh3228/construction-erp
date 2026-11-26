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
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const sessionInfoSchema = z.object({
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
