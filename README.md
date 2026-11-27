# Construction ERP

All-in-one business software for one construction company that works as both a **contractor** and a **developer**. Office staff use the **web app**; site staff use the **mobile app** (offline-first). Built phase by phase; see [docs/PROGRESS.md](docs/PROGRESS.md) for where things stand.

> Demo data only. No real names, PANs, GSTINs or bank details belong in this repository.

## Run everything (one command)

Requires Docker.

```bash
docker compose up --build
```

- Web app: http://localhost:8080 (demo mode: click **Continue as demo user**, or sign in as any demo account such as `demo.finance` with the password `local-demo-only-2026`; fake data only)
- API: through the web server at http://localhost:8080/api (health: `/api/health`, docs: `/api/docs`). The API container is not published on its own port, so sign-in throttling can trust the client address nginx passes on.
- Postgres: localhost:5432 (user `erp`, password `erp`, database `erp_dev`; local demo values)

Ports can be changed with `WEB_PORT` and `DB_PORT`. The API applies migrations and loads demo seeds on start.

## Develop without Docker

Requires Node 22.12+, pnpm 10 (`corepack enable`) and a local Postgres 16.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # edit DATABASE_URL if needed
pnpm db:migrate && pnpm db:seed
pnpm dev                                  # API on :3000, web on :5173
pnpm --filter @erp/mobile start          # Expo dev server for the mobile app (demo mode on in development)
```

## Checks

| Command                 | What it runs                                                                      |
| ----------------------- | --------------------------------------------------------------------------------- |
| `pnpm check`            | Prettier check, ESLint, type checks, unit tests                                   |
| `pnpm test:integration` | API tests against the database in `DATABASE_URL`                                  |
| `pnpm test:e2e`         | Playwright against the running stack (`E2E_BASE_URL`, default :8080)              |
| `pnpm test:clean`       | Drop, migrate and seed a `*_test` database, then all checks and integration tests |

CI (GitHub Actions) runs all of these plus a gitleaks secret scan on every push and pull request.

## Layout

```
apps/api        NestJS + Prisma REST API (OpenAPI at /api/docs)
apps/web        React + Vite web app for office staff
apps/mobile     Expo app for site staff
packages/shared Types, validation schemas, money/date/tax calculation library
packages/config Shared ESLint and TypeScript settings
e2e/            Playwright end-to-end tests
docs/           Architecture, data model, permissions, progress and decisions
```
