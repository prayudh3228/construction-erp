import 'reflect-metadata';
import './load-env-file';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { API_PREFIX, buildOpenApi, configureApp } from './app.setup';
import { ENV } from './config/config.module';
import { type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const env = app.get<Env>(ENV);
  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, () => buildOpenApi(app));
  }
  if (env.AUTH_DEMO_LOGIN) {
    Logger.warn(
      'AUTH_DEMO_LOGIN is ON: anyone who can reach this server can sign in as a demo account without a password. Local demo use only; never on a shared or public server.',
      'Security',
    );
  }
  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
