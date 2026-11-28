import { existsSync } from 'node:fs';

// Integration tests use the real database from DATABASE_URL (CI sets it; locally apps/api/.env).
// Load .env for anything not already set: `pnpm test:clean` sets DATABASE_URL itself but still
// needs the other settings (e.g. AUTH_ENCRYPTION_KEY). loadEnvFile never overwrites a set value.
if (existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.DATABASE_URL) throw new Error('Integration tests need DATABASE_URL');
