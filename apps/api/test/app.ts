import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ENV } from '../src/config/config.module';
import { type Env, loadEnv } from '../src/config/env';

/** Boot the real app (same wiring as main.ts) with optional env overrides. */
export async function createTestApp(overrides: Partial<Env> = {}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue({ ...loadEnv(), NODE_ENV: 'test', ...overrides })
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}
