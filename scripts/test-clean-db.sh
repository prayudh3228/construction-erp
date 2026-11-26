#!/usr/bin/env bash
# Full test run from a clean database: drop -> migrate -> seed -> all tests.
# Only ever touches a database whose name ends in "_test", so it cannot wipe dev data.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${TEST_DATABASE_URL:=postgresql://erp:erp@localhost:5432/erp_test?schema=public}"
db_name="$(node -e "console.log(new URL(process.argv[1]).pathname.slice(1))" "$TEST_DATABASE_URL")"
if [[ "$db_name" != *_test ]]; then
  echo "Refusing: TEST_DATABASE_URL must point at a database ending in _test (got '$db_name')." >&2
  exit 1
fi

export DATABASE_URL="$TEST_DATABASE_URL"
cd apps/api
echo "==> Dropping and recreating schema in $db_name"
printf 'DROP SCHEMA IF EXISTS public CASCADE;\nCREATE SCHEMA public;\n' | pnpm exec prisma db execute --stdin
echo "==> Migrating"
pnpm exec prisma migrate deploy
echo "==> Seeding"
pnpm db:seed
cd ../..
echo "==> Static checks and unit tests"
pnpm check
echo "==> Integration tests"
pnpm test:integration
echo "==> Clean-database run passed"
