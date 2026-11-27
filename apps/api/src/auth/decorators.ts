import { type ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { type Request } from 'express';
import { type Authenticated } from './auth.service';

/** Every route needs a signed-in user unless marked @Public() (health checks, sign-in). */
export const IS_PUBLIC = 'auth:isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Routes a user may still use while they must change their password (first sign-in, or after
 * an admin reset): who am I, sign out, change password. Everything else answers 403.
 */
export const ALLOW_PASSWORD_CHANGE = 'auth:allowPasswordChange';
export const AllowWhilePasswordChangeRequired = () => SetMetadata(ALLOW_PASSWORD_CHANGE, true);

/**
 * Routes a half-signed-in session (password accepted, two-factor still to do) may use:
 * who am I, sign out, and the two-factor steps themselves. Everything else answers 403.
 */
export const ALLOW_DURING_MFA = 'auth:allowDuringMfa';
export const AllowDuringMfa = () => SetMetadata(ALLOW_DURING_MFA, true);

export type AuthedRequest = Request & { auth?: Authenticated };

/** The signed-in user and session, set by AuthGuard. */
export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.auth) throw new Error('CurrentAuth used on a route without AuthGuard');
  return req.auth;
});
