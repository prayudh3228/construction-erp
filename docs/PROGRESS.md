# Progress (handoff file)

A fresh session should be able to resume from this file alone.

## Status

- **Current phase:** 0 (Repo and tooling), built on branch `phase-00-repo-tooling`, awaiting approval.
- **Next phase:** 1 (Design system and shells). Do not start it without approval.

## Done

### Phase 0: Repo and tooling (26-11-2026)

- pnpm + Turborepo monorepo: `apps/api`, `apps/web`, `apps/mobile`, `packages/shared`, `packages/config`.
- Shared ESLint (flat config), Prettier and TypeScript settings.
- API: NestJS 12, Prisma 7 (adapter-pg), first migration (`seed_runs`), idempotent seed framework, Zod-validated env, helmet, CORS, `/api/health` and `/api/health/ready`, Swagger at `/api/docs`.
- Shared library: `Paise` money type with exact parsing, rounding modes, percentage, allocation and ₹ lakh/crore formatting; India dates and financial year; shared health schema.
- Web: Vite + React + Tailwind status page (loading, error with retry, degraded and success states).
- Mobile: Expo SDK 58 placeholder that type-checks and bundles.
- Docker Compose (db, api, web via nginx), GitHub Actions CI (checks, integration with Postgres, Compose + Playwright E2E, gitleaks).
- Docs skeleton and assumptions A1 to A14.
- Fresh-eyes review found 14 items; fixed: formatINR sign/rounding for negative whole-rupee output, `pnpm up` clash (now `pnpm stack:up`), E2E exact-text matching, `erp_test` created by compose, health check timeout (never hangs), seed advisory lock for concurrent starts, nginx re-resolving the API, restart policies, years before 1900 rejected, turbo caching of the generated Prisma client, APP_VERSION in compose. Kept the Expo `AGENTS.md` (useful notes for future sessions).
- Tests: 85 shared unit, 4 API unit, 5 web, 13 API integration, 3 E2E. Changed areas run twice, full suite once from a clean database, E2E twice against the Compose stack: all passed.

## Commands

```bash
pnpm install
docker compose up --build          # whole stack: web :8080, api :3000
pnpm check                         # format, lint, typecheck, unit tests
pnpm test:integration              # needs DATABASE_URL (apps/api/.env)
pnpm test:e2e                      # needs the stack running
pnpm test:clean                    # drop/migrate/seed erp_test, then everything
pnpm --filter @erp/api db:migrate  # create a migration after schema changes
```

## Gotchas

- The Prisma client is generated into `apps/api/src/generated` (git-ignored). `build`, `typecheck` and `dev` run `prisma generate` first.
- API tests use Vitest with `unplugin-swc` so Nest decorator metadata works. Plain esbuild would break DI.
- ESLint's `consistent-type-imports` is off in the API, because Nest needs runtime imports of injected classes.
- `pnpm test:clean` only touches a database whose name ends in `_test` (Compose creates `erp_test` on first start; otherwise `createdb erp_test`).
- Seeding takes a Postgres advisory lock, so several API containers can start at once.
- Locally, Playwright can reuse an installed Chromium with `PW_CHROMIUM_PATH=/path/to/chrome`.
- Money crosses the API as paise strings. Use `toPaiseString` and `fromPaiseString`.

## Decisions log

- 26-11-2026: data-model questions unanswered; proceeding on assumptions A1 to A7 (see ASSUMPTIONS.md, Q1).

## Phase list

A. Foundation: 0 Repo and tooling · 1 Design system and shells · 2 Authentication · 3 Roles and permissions · 4 Audit log and settings · 5 Project master and cost codes · 6 Party master (milestone)
B. Planning: 7 Intake and documents · 8 Estimates and budget · 9 Schedule and completion tracking
C. Purchase: 10 Indent · 11 RFQ and quotes · 12 Purchase order (milestone)
D. Stores and hire: 13 Goods receipt and stock ledger · 14 Issues and transfers · 15 Hired items
E. Accounts: 16 Bills and payments · 17 Journals · 18 Invoice scan · 19 TDS · 20 GST · 21 Site funds · 22 Tally integration (milestone)
F. HR and labour: 23 Employees, attendance, leave · 24 Payroll and statutory · 25 Labour contractors · 26 Exits (milestone)
G. Site and mobile: 27 Site (web) · 28 Mobile sync engine and attendance · 29 Mobile site tools (milestone)
H. Remaining: 30 Sales · 31 Quality, Safety, Legal
I. Closure: 32 Project closure · 33 Dashboards and reports · 34 Hardening (milestone)
