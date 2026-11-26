import { existsSync } from 'node:fs';

// Integration tests use the real database from DATABASE_URL (CI sets it; locally apps/api/.env).
if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.DATABASE_URL) throw new Error('Integration tests need DATABASE_URL');
