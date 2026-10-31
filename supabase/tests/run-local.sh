#!/usr/bin/env bash
# Recreates a DISPOSABLE database, applies bootstrap + all migrations, runs the DB test suite.
# Requires a reachable Postgres 15+ superuser connection in TEST_DATABASE_URL, whose database
# name must end in "_test". Example:
#   TEST_DATABASE_URL=postgresql://postgres@localhost:54329/diagnassis_test npm run test:db
set -euo pipefail
cd "$(dirname "$0")/../.."
URL="${TEST_DATABASE_URL:-postgresql://postgres@localhost:54329/diagnassis_test}"
DB="${URL##*/}"
case "$DB" in *_test) ;; *) echo "Refusing: database name must end in _test (got $DB)"; exit 1;; esac
ADMIN_URL="${URL%/*}/postgres"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -qc "drop database if exists \"$DB\" with (force)" -c "create database \"$DB\""
psql "$URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/bootstrap-local.sql
for f in supabase/migrations/*.sql; do echo "applying $f"; psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
TEST_DATABASE_URL="$URL" npx vitest run --config vitest.db.config.ts
