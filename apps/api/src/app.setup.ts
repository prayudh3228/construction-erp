import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { type NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { clientHeaderMiddleware } from './auth/client-header.middleware';
import { ENV } from './config/config.module';
import { type Env } from './config/env';

export const API_PREFIX = 'api';

/** Shared app wiring used by main.ts, the OpenAPI script and the tests, so they never drift. */
export function configureApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);
  app.setGlobalPrefix(API_PREFIX);
  if (env.TRUST_PROXY) (app as NestExpressApplication).set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.use(clientHeaderMiddleware);
  app.enableCors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: true });
  app.enableShutdownHooks();
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Construction ERP API')
    .setDescription('REST API for the construction ERP. Money fields are integer paise as strings.')
    .setVersion(app.get<Env>(ENV).APP_VERSION)
    .build();
  return SwaggerModule.createDocument(app, config);
}
