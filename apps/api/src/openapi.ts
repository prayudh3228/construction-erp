import 'reflect-metadata';
import './load-env-file';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApi, configureApp } from './app.setup';

/** Writes the OpenAPI spec to apps/api/openapi.json without starting a server. */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  const file = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(file, `${JSON.stringify(buildOpenApi(app), null, 2)}\n`);
  await app.close();
  console.warn(`Wrote ${file}`);
}

void main();
