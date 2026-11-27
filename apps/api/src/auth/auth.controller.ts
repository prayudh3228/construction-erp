import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AUTH_ERROR_CODES,
  type DeviceSession,
  type LoginResponse,
  type MeResponse,
  SESSION_COOKIE,
  changePasswordRequestSchema,
  mfaCodeRequestSchema,
  mfaVerifyRequestSchema,
  type MfaEnableResponse,
  type MfaSetupResponse,
  type MfaStatus,
  loginRequestSchema,
} from '@erp/shared';
import { type Request, type Response } from 'express';
import { z } from 'zod';
import { apiError, parseBody } from '../common/api-error';
import { ENV } from '../config/config.module';
import { type Env, cookieSecure } from '../config/env';
import { AttemptLimiter } from './attempt-limiter';
import { tokenFromRequest } from './auth.guard';
import { type Authenticated, AuthService, type RequestMeta } from './auth.service';
import { clientKind } from './client-header.middleware';
import {
  AllowDuringMfa,
  AllowWhilePasswordChangeRequired,
  CurrentAuth,
  Public,
} from './decorators';
import { MfaService } from './mfa.service';

const demoLoginSchema = z.object({ username: z.string().trim().min(1).max(120) });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly limiter: AttemptLimiter,
    private readonly mfa: MfaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Run a sign-in style action with per-address throttling: a source that keeps failing is
   * refused (429) before any password is checked. Only failures count, so an office signing in
   * correctly from one shared address is never blocked.
   */
  private async throttled<T>(req: Request, action: () => Promise<T>): Promise<T> {
    const key = req.ip ?? 'unknown';
    if (this.limiter.isBlocked(key)) {
      throw apiError(
        HttpStatus.TOO_MANY_REQUESTS,
        AUTH_ERROR_CODES.tooManyAttempts,
        'Too many failed attempts from this network. Please wait a few minutes and try again.',
      );
    }
    try {
      return await action();
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 500;
      if (status === 400 || status === 401) this.limiter.recordFailure(key);
      throw error;
    }
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign in with username and password',
    description:
      'Web clients (x-erp-client: web) get an httpOnly session cookie. Mobile clients (x-erp-client: mobile) get the token in the body and send it as a Bearer token.',
  })
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { username, password } = parseBody(loginRequestSchema, body);
    const client = clientKind(req) ?? 'web';
    const result = await this.throttled(req, () =>
      this.auth.login(username, password, client, meta(req)),
    );
    // Signing in over someone else's session (shared PC): end the old one on the server too.
    await this.auth.revokeToken(tokenFromRequest(req), 'replaced_by_new_sign_in');
    return this.respondWithSession(result, client, res);
  }

  @Public()
  @Post('demo-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Demo only: sign in as a seeded demo account (AUTH_DEMO_LOGIN=true)' })
  async demoLogin(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { username } = parseBody(demoLoginSchema, body);
    const client = clientKind(req) ?? 'web';
    const result = await this.throttled(req, () =>
      this.auth.demoLogin(username, client, meta(req)),
    );
    await this.auth.revokeToken(tokenFromRequest(req), 'replaced_by_new_sign_in');
    return this.respondWithSession(result, client, res);
  }

  @Post('logout')
  @HttpCode(204)
  @AllowWhilePasswordChangeRequired()
  @AllowDuringMfa()
  @ApiOperation({ summary: 'Sign out this device' })
  async logout(
    @CurrentAuth() auth: Authenticated,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(auth.session.id);
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @AllowWhilePasswordChangeRequired()
  @AllowDuringMfa()
  @ApiOperation({ summary: 'The signed-in user and when the session ends' })
  me(@CurrentAuth() auth: Authenticated): MeResponse {
    return { user: this.auth.toAuthUser(auth.user), session: this.auth.sessionInfo(auth.session) };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Your signed-in devices' })
  sessions(@CurrentAuth() auth: Authenticated): Promise<DeviceSession[]> {
    return this.auth.activeSessions(auth);
  }

  @Post('change-password')
  @HttpCode(200)
  @AllowWhilePasswordChangeRequired()
  @ApiOperation({
    summary: 'Change your password',
    description:
      'Ends every session of the user, including this one, and opens a new one: web gets a new cookie, mobile gets a new token in the body.',
  })
  async changePassword(
    @CurrentAuth() auth: Authenticated,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { currentPassword, newPassword } = parseBody(changePasswordRequestSchema, body);
    const result = await this.throttled(req, () =>
      this.auth.changePassword(auth, currentPassword, newPassword, meta(req)),
    );
    // For the web the new cookie simply replaces the old one.
    return this.respondWithSession(
      result,
      result.session.client === 'MOBILE' ? 'mobile' : 'web',
      res,
    );
  }

  // ---- Two-factor sign-in ------------------------------------------------------------------

  @Get('mfa')
  @ApiOperation({ summary: 'Your two-factor status and how many recovery codes are left' })
  mfaStatus(@CurrentAuth() auth: Authenticated): Promise<MfaStatus> {
    return this.mfa.status(auth.user);
  }

  @Post('mfa/setup')
  @HttpCode(200)
  @AllowDuringMfa()
  @ApiOperation({ summary: 'Start setting up an authenticator app (returns the secret to scan)' })
  mfaSetup(@CurrentAuth() auth: Authenticated): Promise<MfaSetupResponse> {
    return this.mfa.startSetup(auth);
  }

  @Post('mfa/enable')
  @HttpCode(200)
  @AllowDuringMfa()
  @ApiOperation({
    summary: 'Confirm setup with a code; two-factor is on',
    description:
      'Ends every session and opens a new, fully signed-in one. Returns the recovery codes, once.',
  })
  async mfaEnable(
    @CurrentAuth() auth: Authenticated,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MfaEnableResponse> {
    const { code } = parseBody(mfaCodeRequestSchema, body);
    const result = await this.throttled(req, () => this.mfa.enable(auth, code, meta(req)));
    const session = this.respondWithSession(result, clientOfSession(result), res);
    return { ...session, recoveryCodes: result.recoveryCodes };
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @AllowDuringMfa()
  @ApiOperation({
    summary: 'Second sign-in step: an authenticator code or a recovery code',
    description: 'On success the half-signed-in session ends and a new, full one opens.',
  })
  async mfaVerify(
    @CurrentAuth() auth: Authenticated,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const input = parseBody(mfaVerifyRequestSchema, body);
    const result = await this.throttled(req, () => this.mfa.verify(auth, input, meta(req)));
    return this.respondWithSession(result, clientOfSession(result), res);
  }

  @Post('mfa/recovery-codes')
  @HttpCode(200)
  @ApiOperation({ summary: 'Make new recovery codes (old ones stop working); needs an app code' })
  async mfaRecoveryCodes(
    @CurrentAuth() auth: Authenticated,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ recoveryCodes: string[] }> {
    const { code } = parseBody(mfaCodeRequestSchema, body);
    const recoveryCodes = await this.throttled(req, () =>
      this.mfa.regenerateRecoveryCodes(auth, code),
    );
    return { recoveryCodes };
  }

  @Post('mfa/disable')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Switch two-factor off (not for roles that require it); needs an app code',
  })
  async mfaDisable(
    @CurrentAuth() auth: Authenticated,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<MeResponse> {
    const { code } = parseBody(mfaCodeRequestSchema, body);
    const user = await this.throttled(req, () => this.mfa.disable(auth, code));
    return { user: this.auth.toAuthUser(user), session: this.auth.sessionInfo(auth.session) };
  }

  private respondWithSession(
    result: Authenticated & { token: string },
    client: 'web' | 'mobile',
    res: Response,
  ): LoginResponse {
    const body: LoginResponse = {
      user: this.auth.toAuthUser(result.user),
      session: this.auth.sessionInfo(result.session),
    };
    if (client === 'mobile') return { ...body, token: result.token };
    res.cookie(SESSION_COOKIE, result.token, {
      ...this.cookieOptions(),
      maxAge: this.auth.absoluteTimeoutMs('WEB'),
    });
    return body;
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: cookieSecure(this.env),
      sameSite: 'lax' as const,
      path: '/api',
    };
  }
}

function meta(req: Request): RequestMeta {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

function clientOfSession(result: Authenticated): 'web' | 'mobile' {
  return result.session.client === 'MOBILE' ? 'mobile' : 'web';
}
