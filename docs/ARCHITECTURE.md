# Architecture

## Overview

A TypeScript monorepo (pnpm workspaces + Turborepo) with three apps and two packages.

```
            ┌──────────────┐        ┌───────────────┐
 office ──▶ │  apps/web    │──/api─▶│   apps/api    │──▶ PostgreSQL 16
            │ React + Vite │        │ NestJS+Prisma │
            └──────────────┘        └───────────────┘
 site   ──▶ ┌──────────────┐               ▲
            │ apps/mobile  │── sync queue ─┘   (Phase 28)
            │ Expo, SQLite │
            └──────────────┘
      all three import packages/shared (types, Zod schemas, calculations)
```

## Decisions

| Area            | Choice                                                                                                                                    | Why                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager | pnpm 10 workspaces, Turborepo                                                                                                             | Fast, strict dependency isolation, cached task graph                                                                                                                  |
| Language        | TypeScript 6.0 (strict)                                                                                                                   | TS 7 is out, but typescript-eslint supports up to 6.0, and Expo SDK 58 ships with 6.0                                                                                 |
| API             | NestJS 12, CommonJS build                                                                                                                 | Module system and DI suit a large, rule-heavy API. CommonJS keeps Nest decorators and Prisma simple; it loads the ESM shared package through Node 22's `require(esm)` |
| ORM             | Prisma 7 with `@prisma/adapter-pg`                                                                                                        | Typed queries and migrations. The generated client lives in `apps/api/src/generated` (git-ignored)                                                                    |
| Validation      | Zod 4 in `packages/shared`                                                                                                                | One schema for API and clients (e.g. `healthResponseSchema`)                                                                                                          |
| API docs        | `@nestjs/swagger`, served at `/api/docs` outside production                                                                               | OpenAPI spec as the brief requires. `pnpm --filter @erp/api openapi` writes `openapi.json`                                                                            |
| Web             | React 19, Vite 8, Tailwind 4, TanStack Query, TanStack Router (code-based routes), TanStack Table v8, Radix UI (`radix-ui`), cmdk, sonner | shadcn/ui-style components written by hand on our tokens (A21)                                                                                                        |
| Mobile          | Expo SDK 58 (React Native 0.88)                                                                                                           | expo-sqlite and the sync queue arrive in Phase 28                                                                                                                     |
| Tests           | Vitest everywhere (SWC plugin in the API for decorator metadata), Supertest for API integration against real Postgres, Playwright for E2E |                                                                                                                                                                       |
| Local run       | Docker Compose: `db`, `api` (migrate, seed, start), `web` (nginx serving the build and proxying `/api`)                                   | One command                                                                                                                                                           |

## API conventions

- Every route is under `/api`. Health: `GET /api/health` (always 200, reports database state) and `GET /api/health/ready` (503 until the database answers).
- Environment variables are validated with Zod at startup (`apps/api/src/config/env.ts`); the API refuses to boot on bad config.
- `configureApp()` in `app.setup.ts` is shared by `main.ts`, the OpenAPI script and the tests, so they never drift.
- Security headers via helmet; CORS limited to `CORS_ORIGIN` (comma-separated).
- **Money on the wire is integer paise as a string** (`"123456"` = ₹1,234.56), because JSON has no bigint.

## Shared calculation library (`packages/shared`)

- `money/`: the `Paise` type, parsing (`rupees('1234.56')`), arithmetic, `multiply`/`percentage` with explicit rounding, `roundTo` (nearest rupee or ₹10), `allocate` (split without losing a paisa), and `formatINR` with lakh/crore grouping.
- `money/rounding.ts`: `divRound` with HALF_UP (default), HALF_EVEN, DOWN, UP, FLOOR and CEIL. Rounding happens once, at the end of a calculation.
- `dates/`: ISO calendar dates (`YYYY-MM-DD`), display as DD-MM-YYYY, instants converted in India time (Asia/Kolkata), and `financialYearOf()` for April to March years.

## Design system (Phase 1)

- **Tokens** (`packages/shared/src/theme/tokens.ts`) are the one place for colours, type scale, spacing, radii, shadows, motion and layout sizes. Components use semantic names (`bg-surface`, `text-muted-foreground`, `bg-primary`), never raw colours.
- **Web:** `pnpm --filter @erp/web theme` writes `apps/web/src/styles/theme.generated.css` (CSS variables + Tailwind 4 `@theme inline`). A unit test fails if the file and the tokens differ, and another fails if `index.css` contains a hex colour. **Mobile** reads the same tokens directly (Phase 1b).
- **Contrast:** a unit test checks every text/background pair in both themes against WCAG AA (4.5:1 text, 3:1 for focus rings, field borders and icons). Playwright runs axe in a real browser, including contrast.
- **Branding** comes only through `useBranding()` (placeholders from `@erp/shared` now, settings from Phase 4).
- **Components** live in `apps/web/src/components/ui` (Button, Input, NativeSelect, Label, FormField, Card, Badge, Checkbox, Dialog/Sheet, DropdownMenu, Popover, Command, Tooltip, Toaster, Skeleton), plus `states.tsx` (Empty/Error/Loading), `page-header.tsx`, `format.tsx` (`<Money>`, `<IndianDate>`) and `data-table/` (search, filters, sorting, pagination, column chooser, all states). A living reference is at `/design-system` in demo mode.

## Web shell (Phase 1)

- Routes (`apps/web/src/app/router.tsx`): `/login`, `/status` (public), and behind the sign-in guard `/` (redirects to the first visible department), `/$departmentId`, `/design-system` (demo only). The login `redirect` parameter only accepts same-site paths (`safeRedirectPath`).
- The **department registry** (`packages/shared/src/navigation/departments.ts`) drives the sidebar and will drive department permissions. `visibleDepartments(access)` decides what the UI shows; the API enforces access from Phase 3.
- The **project switcher** value is in the URL (`?project=`), parsed by `parseProjectScope`, so it survives reloads, can be shared, and carries across departments. Ctrl/⌘+K opens it.
- Projects come through the `ProjectsSource` interface (`apps/web/src/data/projects.ts`): demo fixtures now, the API in Phase 5.
- Every department page follows one template: All-projects summary + table, one project's view, or the Company-wide section, each with loading, empty and error states.

## Seeds

`apps/api/prisma/seed/seeds.ts` lists named seeds. The runner applies each one once, inside a transaction holding a Postgres advisory lock, and records it in `seed_runs`, so seeding is safe to repeat and safe when several API containers start together. Change demo data by adding a new seed, not by editing an applied one. The seed command refuses to run when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true`.
