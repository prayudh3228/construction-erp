import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CLOCK, systemClock } from './clock';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: CLOCK, useValue: systemClock },
    // Global: every route in every module is signed-in-only unless marked @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
