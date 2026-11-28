import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_ERROR_CODES, SESSION_COOKIE } from '@erp/shared';
import { apiError } from '../common/api-error';
import { AuthService } from './auth.service';
import {
  ALLOW_DURING_MFA,
  ALLOW_PASSWORD_CHANGE,
  type AuthedRequest,
  IS_PUBLIC,
} from './decorators';

/** Bearer token (phone) wins over the cookie (browser). */
export function tokenFromRequest(req: AuthedRequest): unknown {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookies = req.cookies as Record<string, unknown> | undefined;
  return cookies?.[SESSION_COOKIE];
}

/**
 * Global guard: every route requires a valid session unless @Public(). This is where leavers and
 * timed-out sessions are refused, on every request. Permissions per role come in Phase 3.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const authenticated = await this.auth.authenticate(tokenFromRequest(req));
    req.auth = authenticated;

    // Half signed in: only the two-factor steps until they are done. A new starter in a role
    // that needs two-factor changes the temporary password first, so that is allowed too.
    if (authenticated.session.stage !== 'FULL') {
      if (this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_MFA, targets)) return true;
      if (
        authenticated.session.stage === 'MFA_SETUP' &&
        authenticated.user.mustChangePassword &&
        this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE, targets)
      ) {
        return true;
      }
      throw apiError(
        HttpStatus.FORBIDDEN,
        AUTH_ERROR_CODES.mfaRequired,
        'Finish two-factor sign-in first.',
      );
    }

    if (
      authenticated.user.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE, targets)
    ) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        AUTH_ERROR_CODES.passwordChangeRequired,
        'Please change your password before continuing.',
      );
    }
    return true;
  }
}
