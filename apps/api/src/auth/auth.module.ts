import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { AttemptLimiter } from './attempt-limiter';
import { CLOCK, type Clock, systemClock } from './clock';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    MfaService,
    { provide: CLOCK, useValue: systemClock },
    {
      provide: AttemptLimiter,
      inject: [ENV, CLOCK],
      useFactory: (env: Env, clock: Clock) =>
        new AttemptLimiter(env.AUTH_IP_MAX_FAILURES, env.AUTH_IP_WINDOW_MINUTES * 60_000, clock),
    },
    // Global: every route in every module is signed-in-only unless marked @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
