import { type INestApplication } from '@nestjs/common';
import { healthResponseSchema } from '@erp/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app';

describe('GET /api/health (database up)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp({ APP_VERSION: '9.9.9-test' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('reports ok with the database up, matching the shared schema', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    const body = healthResponseSchema.parse(res.body);
    expect(body).toMatchObject({ status: 'ok', version: '9.9.9-test', checks: { database: 'up' } });
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });

  it('is ready', async () => {
    await request(app.getHttpServer()).get('/api/health/ready').expect(200);
  });

  it('sets security headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the configured web origin only', async () => {
    const ok = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns 404 outside the /api prefix', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});

describe('GET /api/health (database down)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    // Port 1 on localhost refuses connections immediately.
    app = await createTestApp({ DATABASE_URL: 'postgresql://erp:erp@127.0.0.1:1/none' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('stays alive and reports degraded', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'degraded', checks: { database: 'down' } });
  });

  it('is not ready (503)', async () => {
    await request(app.getHttpServer()).get('/api/health/ready').expect(503);
  });
});
