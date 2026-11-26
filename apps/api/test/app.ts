import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { CLOCK, type Clock } from '../src/auth/clock';
import { configureApp } from '../src/app.setup';
import { ENV } from '../src/config/config.module';
import { type Env, loadEnv } from '../src/config/env';

/** Boot the real app (same wiring as main.ts) with optional env overrides. */
export async function createTestApp(
  overrides: Partial<Env> = {},
  options: { clock?: Clock } = {},
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    // Low hashing cost keeps tests fast; production enforces at least 17.
    .useValue({ ...loadEnv(), NODE_ENV: 'test', PASSWORD_HASH_COST: 12, ...overrides });
  if (options.clock) builder = builder.overrideProvider(CLOCK).useValue(options.clock);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

/** A clock tests can move forward: `clock.advance(31 * 60_000)`. */
export class FakeClock implements Clock {
  constructor(private current = new Date('2026-11-26T04:30:00.000Z')) {}
  now(): Date {
    return new Date(this.current.getTime());
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
