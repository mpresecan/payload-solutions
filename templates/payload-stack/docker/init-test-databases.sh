#!/bin/sh
# Runs on first start of the `postgres-test` container (see docker-compose.yml). POSTGRES_DB
# already created the integration database; the journeys get their own next to it so `pnpm test`
# can run both suites without one seeing the other's data.
#
# The container keeps its data in tmpfs, so "first start" is every start: both databases are
# recreated empty whenever you `docker compose up`.
set -e

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c 'CREATE DATABASE "payload-stack-e2e"'
