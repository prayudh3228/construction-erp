import { existsSync } from 'node:fs';

/** Load apps/api/.env for local runs. Variables already set (e.g. by Docker) win. */
if (existsSync('.env')) process.loadEnvFile('.env');
