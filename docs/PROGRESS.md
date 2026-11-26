# Progress (handoff file)

A fresh session should be able to resume from this file alone.

## Status

- **Current phase:** 1a (Design system and web shell), built on branch `phase-01-design-shells`, awaiting approval.
- **Next phase:** 1b (Mobile shell: Expo Router tabs Today/Capture/Sync/More, login placeholder, offline banner via NetInfo, sync status pill, shared tokens, 48dp touch targets). Do not start it without approval.
- Phase 1 was split into 1a (web) and 1b (mobile) because it was too big for one PR.

## Done

### Phase 1a: Design system and web shell (26-11-2026)

- Design tokens in `packages/shared/src/theme` (one file), generated to `apps/web/src/styles/theme.generated.css`; WCAG contrast tested for every pair in light and dark (contrast test caught too-faint field borders, fixed).
- Shared: department registry (13 departments, groups, Sales development-only, Admin not project-scoped), `?project=` scope parsing with reserved ids, provisional `ProjectSummary`, login form schema, branding placeholders.
- Web: shadcn-style components on Radix, `<Money>`/`<IndianDate>`, Empty/Error/Loading states, DataTable (search, filters, sort, pagination, column chooser, all states), TanStack Router shell (sidebar with collapse and tablet drawer, top bar, Ctrl+K project switcher, account menu, skip link), login page with inline validation and demo sign-in, department page template, design-system reference page (demo only, lazy-loaded), not-found page.
- Demo mode is off for every build unless asked for; only Docker Compose turns it on (`docker/web.Dockerfile` defaults to off).
- Accessibility: per-page tab titles, focus moves to the new page heading after navigation, axe scans (jsdom and real browser).
- Fresh-eyes review found 9 items, all fixed: Dockerfile and custom `--mode` builds defaulted demo mode on; fake projects shown with demo mode off; table showed an empty page after data shrank; search ignored displayed text (dates, labels); router JSON-parsed `?project=` (`1e3` became 1000) — now raw strings via `search-params.ts`; no page titles or focus on navigation; no storage-failure test; cmdk view values could collide with project ids.
- Repo: `.gitattributes` forces LF (Windows checkouts broke Prettier).

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

Phase 1 adds:

```bash
pnpm --filter @erp/web theme       # regenerate theme CSS after editing tokens.ts (build shared first)
E2E_SCREENSHOT_DIR=docs/screenshots pnpm test:e2e   # also save the key screens for the PR
```

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

- Demo mode is decided at build time. `vite.config.ts` defaults it on for the dev server and tests, off for any `vite build`; Compose passes `VITE_DEMO_MODE=true` (the Dockerfile default is false). In tests, switch it with `vi.stubEnv('VITE_DEMO_MODE', 'false')`.
- Don't throw `notFound()` from a child route's `beforeLoad`: TanStack Router then renders it in place of the shell. Render `<NotFoundPage />` from the page instead (see DepartmentPage).
- TanStack Table defaults numeric columns to descending on the first click; the DataTable sets `sortDescFirst: false`. Sort money with a bigint comparator, never by converting to number.
- cmdk lists must not contain separators (ARIA listbox rules; axe fails). Separate groups with a border.
- Radix dropdowns make the rest of the page `aria-hidden` while open; close them (Escape) in tests before querying the page.
- Playwright axe scans wait for sonner toasts to finish fading in, otherwise contrast is measured mid-fade.
- Web unit tests render the real router with `renderApp(path)` and `signIn(access)` from `apps/web/src/test/render-app.tsx`.
- The main web bundle is ~230 kB gzipped (Vite warns about >500 kB minified). Lazy-load department pages as they gain real screens.
- On Windows, check out with LF endings (`.gitattributes` enforces it). Locally, Playwright can use an installed Chrome via `PW_CHROMIUM_PATH` instead of downloading one.
- The Prisma client is generated into `apps/api/src/generated` (git-ignored). `build`, `typecheck` and `dev` run `prisma generate` first.
- API tests use Vitest with `unplugin-swc` so Nest decorator metadata works. Plain esbuild would break DI.
- ESLint's `consistent-type-imports` is off in the API, because Nest needs runtime imports of injected classes.
- `pnpm test:clean` only touches a database whose name ends in `_test` (Compose creates `erp_test` on first start; otherwise `createdb erp_test`).
- Seeding takes a Postgres advisory lock, so several API containers can start at once.
- Locally, Playwright can reuse an installed Chromium with `PW_CHROMIUM_PATH=/path/to/chrome`.
- Money crosses the API as paise strings. Use `toPaiseString` and `fromPaiseString`.

## Decisions log

- 26-11-2026: Phase 1 split into 1a (web) and 1b (mobile). TanStack Table v8 over v9 (A15). Demo mode build flag (A19). Q4 assumed: GitHub Actions is the gate, plus a full local run before each PR.

- 26-11-2026: data-model questions unanswered; proceeding on assumptions A1 to A7 (see ASSUMPTIONS.md, Q1).

## Phase list

A. Foundation: 0 Repo and tooling · 1a Design system and web shell · 1b Mobile shell · 2 Authentication · 3 Roles and permissions · 4 Audit log and settings · 5 Project master and cost codes · 6 Party master (milestone)
B. Planning: 7 Intake and documents · 8 Estimates and budget · 9 Schedule and completion tracking
C. Purchase: 10 Indent · 11 RFQ and quotes · 12 Purchase order (milestone)
D. Stores and hire: 13 Goods receipt and stock ledger · 14 Issues and transfers · 15 Hired items
E. Accounts: 16 Bills and payments · 17 Journals · 18 Invoice scan · 19 TDS · 20 GST · 21 Site funds · 22 Tally integration (milestone)
F. HR and labour: 23 Employees, attendance, leave · 24 Payroll and statutory · 25 Labour contractors · 26 Exits (milestone)
G. Site and mobile: 27 Site (web) · 28 Mobile sync engine and attendance · 29 Mobile site tools (milestone)
H. Remaining: 30 Sales · 31 Quality, Safety, Legal
I. Closure: 32 Project closure · 33 Dashboards and reports · 34 Hardening (milestone)
