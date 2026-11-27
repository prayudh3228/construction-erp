# Progress (handoff file)

A fresh session should be able to resume from this file alone.

## Status

- **Current phase:** 2a (Authentication core), built on branch `phase-02a-auth-core`, awaiting approval. Phase 1a and 1b are merged (PRs #2, #3).
- Phase 2 is split: **2a** users, passwords, sessions/timeouts, lockout, sign-in/out, password change (this); **2b** two-factor (TOTP + recovery codes) for Admin/Director/Finance; **2c** user admin (create, deactivate leavers, reset password) and phone sign-in with secure storage.
- **Next:** 2b. Do not start it without approval.
- Phase 1 was split into 1a (web) and 1b (mobile) because it was too big for one PR.

## Done

### Phase 2a: Authentication core (26-11-2026)

- API: `users` and `sessions` tables (+ CHECK constraints), scrypt hashing with upgrade-on-login, server-side sessions (token hash only), web cookie / mobile Bearer, idle and absolute timeouts (web 30 min / 12 h, mobile 7 d / 30 d), lockout (5 then 15 min), generic failure message with dummy hash, leaver deactivation ends sessions, password change ends other sessions, must-change-password gate, `GET /auth/sessions`, demo-only sign-in (refused in production), global guard with `@Public()`, CSRF client header.
- Shared: password policy (NIST style) with messages, provisional role keys (`MFA_REQUIRED_ROLES`), demo accounts, auth API schemas and error codes.
- Web: real sign-in (password + demo accounts), change-password page with live checklist, forced change for new starters, session timeout warning, any 401 returns to sign-in, server-unreachable page, sign-out.
- Seeds: one demo user per role, a new starter and a leaver (password from `DEMO_USER_PASSWORD`).
- Fresh-eyes security review: no authentication bypass found; 11 items, 10 fixed: parallel guesses could get past the lockout (now each try is reserved atomically before the password check); no per-address throttling (added, failures only) or hashing cap (added); change-password could be used to guess the password (now counts towards lockout and ends all sessions at the limit); web blank screen when the session vanished (now returns to sign-in); countdown could run up to a minute past the server's deadline (now counts down a minute early); a sign-in racing a password change could keep a session, and the changing session kept its token (now every session ends and a new one opens; older sessions refused); demo sign-in on a non-production deployment (startup warning, Compose comment, API no longer on its own port); signing in over a session left it open (now ended); email sign-in promised but missing (now supported). Not fixed, recorded in NOT_COVERED: slightly faster answers for accounts hashed at an older cost.

### Phase 1b: Mobile shell (26-11-2026)

- Expo Router app (`apps/mobile/src/app`): login (inline validation with the shared schema, demo sign-in), tabs Today (current site picker, site-action tiles marked with their phase), Capture (camera-first placeholder), Sync (status, waiting count, last synced, Sync now with reasons), More (user, office departments, sign out).
- Offline banner from NetInfo and a sync status pill on every screen; theme from the shared tokens; 48dp/56dp touch targets.
- Demo fixtures moved to `@erp/shared/demo` (used by web and mobile).
- Jest set up for mobile (jest-expo, Testing Library v14, `renderRouter`), 51 tests; mobile tests now run in `pnpm test` and CI.
- Fresh-eyes review: no blocking bugs; 9 smaller items, 8 fixed: Sync screen contradicted itself after a failed sync and could show an enabled button that did nothing (now always explains, busy while syncing); screen-reader announcements now work on iOS too (`useAnnounce`); deep links opened while signed out return there after sign-in (`?next=`, allow-listed); keyboard Next moves to the password; sign-out clears every per-user store with one navigation; one shared NetInfo listener (no "Checking…" flash on new tabs); stronger demo-mode tests; required fields announced. **Not fixed (minor):** Today's date only refreshes when the screen re-renders, so an app left open overnight can show yesterday until touched.

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

- Every API route is signed-in-only by default (global `AuthGuard`). Mark public routes with `@Public()`; routes a must-change-password user may use with `@AllowWhilePasswordChangeRequired()`.
- In Docker the API is only reachable through nginx at http://localhost:8080/api (no port 3000 on the host). For local API work use `pnpm dev` (API on :3000).
- Every non-GET request needs `x-erp-client: web|mobile` or the API answers 403 `CLIENT_HEADER_MISSING`. The web `apiFetch` adds it.
- API integration tests: `createTestApp(overrides, { clock })` with `FakeClock` to move time; `PASSWORD_HASH_COST` is 12 in tests (production enforces at least 17). Test users use the `zz.` username prefix and are deleted after each test.
- Web unit tests run against `FakeAuth` (`src/test/fake-auth.ts`); `signIn(access, name, extra)` starts a test signed in. `resetApiActivity()` runs before each test (module state).
- E2E password sign-ins can take a few seconds under parallel load (production-cost scrypt in Docker); `auth.spec.ts` allows 15 s for those steps only.
- Seeding needs `DEMO_USER_PASSWORD` (Compose and CI set it; locally it is in `apps/api/.env`).

- Mobile: add Expo packages with `pnpm exec expo install <pkg>` (picks SDK-matching versions), run from `apps/mobile`. It is slow on Windows (minutes).
- Mobile Jest: Testing Library v14 `fireEvent` returns a promise; always `await` it (and `await act(async () => ...)`), or updates leak into the next test. `jest.setup.ts` unmounts before resetting the shared stores.
- Mobile Jest `transformIgnorePatterns` is the Expo pnpm pattern plus `standard-navigation` (an ESM-only dependency of expo-router).
- `Tabs` from `expo-router` is deprecated in SDK 58; import it from `expo-router/js-tabs`. `Stack`, `Link`, `Redirect` still come from `expo-router`.
- To look at the mobile screens without a phone: `EXPO_PUBLIC_DEMO_MODE=true pnpm --filter @erp/mobile exec expo export --platform web --output-dir dist-web`, serve that folder, and open it at phone size. A production export has demo mode off.

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

- 26-11-2026: Phase 2 split into 2a/2b/2c. Server-side sessions (A32), scrypt (A33), lockout and generic messages (A34). Q1 to be answered by the owner before Phase 5; Q2 deferred to the end.
- 26-11-2026: Phase 1b built on top of the unmerged 1a branch. System font on mobile (A25), single current site on the phone (A26).
- 26-11-2026: Phase 1 split into 1a (web) and 1b (mobile). TanStack Table v8 over v9 (A15). Demo mode build flag (A19). Q4 assumed: GitHub Actions is the gate, plus a full local run before each PR.

- 26-11-2026: data-model questions unanswered; proceeding on assumptions A1 to A7 (see ASSUMPTIONS.md, Q1).

## Phase list

A. Foundation: 0 Repo and tooling · 1a Design system and web shell · 1b Mobile shell · 2a Auth core · 2b Two-factor · 2c User admin and phone sign-in · 3 Roles and permissions · 4 Audit log and settings · 5 Project master and cost codes · 6 Party master (milestone)
B. Planning: 7 Intake and documents · 8 Estimates and budget · 9 Schedule and completion tracking
C. Purchase: 10 Indent · 11 RFQ and quotes · 12 Purchase order (milestone)
D. Stores and hire: 13 Goods receipt and stock ledger · 14 Issues and transfers · 15 Hired items
E. Accounts: 16 Bills and payments · 17 Journals · 18 Invoice scan · 19 TDS · 20 GST · 21 Site funds · 22 Tally integration (milestone)
F. HR and labour: 23 Employees, attendance, leave · 24 Payroll and statutory · 25 Labour contractors · 26 Exits (milestone)
G. Site and mobile: 27 Site (web) · 28 Mobile sync engine and attendance · 29 Mobile site tools (milestone)
H. Remaining: 30 Sales · 31 Quality, Safety, Legal
I. Closure: 32 Project closure · 33 Dashboards and reports · 34 Hardening (milestone)
