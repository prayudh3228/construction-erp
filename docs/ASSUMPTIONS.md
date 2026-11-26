# Assumptions

Each assumption can be changed; the ones marked **(data model)** are expensive to change later, so please confirm them.

| #   | Date       | Assumption                                                                                                                                                                                 | Phase |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| A1  | 26-11-2026 | **(data model)** One legal entity with one GSTIN for now. Records that need it will reference a company row, so more entities, GSTINs or JVs can be added later.                           | 0     |
| A2  | 26-11-2026 | **(data model)** One Tally company covers all the books.                                                                                                                                   | 0     |
| A3  | 26-11-2026 | **(data model)** Project → Block (tower, wing or phase; optional) → cost code.                                                                                                             | 0     |
| A4  | 26-11-2026 | **(data model)** A company-wide standard cost-code list, plus extra codes per project.                                                                                                     | 0     |
| A5  | 26-11-2026 | **(data model)** One party record can be both a creditor and a debtor (roles), as in Tally.                                                                                                | 0     |
| A6  | 26-11-2026 | **(data model)** Stock is held per site (store location) and valued at weighted average cost.                                                                                              | 0     |
| A7  | 26-11-2026 | **(data model)** A project is either Contract or Development, not both.                                                                                                                    | 0     |
| A8  | 26-11-2026 | Money is stored as integer paise (Postgres BIGINT) and sent over the API as a string of paise.                                                                                             | 0     |
| A9  | 26-11-2026 | Default rounding is half away from zero (HALF_UP), applied once at the end of a calculation. Specific taxes can choose another mode or round to the nearest rupee or ₹10 through settings. | 0     |
| A10 | 26-11-2026 | Business dates are calendar dates in India time (Asia/Kolkata). Financial year runs 1 April to 31 March, labelled like "2026-27".                                                          | 0     |
| A11 | 26-11-2026 | TypeScript 6.0 rather than 7.0, because typescript-eslint and Expo SDK 58 support up to 6.0. Upgrade when they support 7.                                                                  | 0     |
| A12 | 26-11-2026 | The API is built as CommonJS (Nest 12 and the shared package are ESM and load through Node 22's `require(esm)`).                                                                           | 0     |
| A13 | 26-11-2026 | The local Docker stack serves the web build through nginx on port 8080. `pnpm dev` (Vite on 5173) is for day-to-day development.                                                           | 0     |
| A14 | 26-11-2026 | The API Docker image uses the full `node:22-bookworm` base because Prisma's migration engine needs OpenSSL. A slim production image comes in Phase 34.                                     | 0     |
