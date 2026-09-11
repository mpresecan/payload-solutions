# Vercel Integration plugin — handoff (11 September 2026)

## What is in `plugin-vercel.tar`

Extract at the repo root (`cd ~/Projects/payload-ecosystem && tar -xf _to_delete/staging/plugin-vercel.tar` or from wherever you saved it):

- `packages/plugin-vercel/` — the plugin, in the official plugin-template layout (src/ + dev/ app + swc/tsc build + vitest + Playwright), 4,861 lines of source.
- `docs/plugins/vercel-integration/` — 8 docs pages + meta.json (index, installation, configuration, auto-deploy, status, admin, api, recipes).

## What you need to run

```sh
pnpm install                                                   # new workspace package → lockfile
pnpm --filter @payload-solutions/plugin-vercel test            # 24 unit + 19 int tests (sqlite, mock Vercel in-process)
pnpm --filter @payload-solutions/plugin-vercel typecheck
pnpm --filter @payload-solutions/plugin-vercel lint
pnpm --filter @payload-solutions/plugin-vercel test:e2e        # Playwright; starts the mock (:3399) and the dev app (:3400)
```

To look at the admin: `cp dev/.env.example dev/.env`, then `pnpm dev:mock-vercel` in one terminal and `pnpm dev` in another (dev@payloadcms.com / test, http://localhost:3400/admin). Publish a page, watch the header pill count down, open Deployments in the nav.

## Verified in the cloud (Payload 3.88.0 + Postgres 16, node:test harness)

- 19 integration tests: change tracking (drafts publish/unpublish/delete, no-drafts every save, per-target routing, untracked + `vercelSkip`, globals), debounce window arithmetic, exactly one trigger from three concurrent ticks, matching to the Vercel deployment and following it to ready, manual endpoint with user + hourly limit, failed hook call (retry on 5xx, re-instate), failed build re-instates / superseded build does not, flush + pause, tick endpoint secret, cancel, rollback (candidates, pointer, re-instatement), external deployments, signed webhook (403 / duplicate / state updates / unknown project), retention.
- 24 unit tests: options, hook URL parsing, schedule, matcher, state machine, classification, summaries, durations, HMAC.
- Full `tsc` typecheck of src (server + React components) against the real `payload`, `@payloadcms/ui` and `@payloadcms/next` 3.88 types.

Not run in the cloud: eslint, Playwright, `next dev` (no npm registry access in this session — `create-payload-app` could not be executed either; the template came from `git archive v3.88.0 templates/plugin` of your Payload clone, byte-identical to what the CLI downloads).

## Follow-ups in the monorepo

1. `apps/payload-solutions/src/seed/index.ts`: plugin row `vercel-integration` → `status: 'available'`, roadmap item "Vercel Integration plugin" → shipped (seed only runs on an empty collection — change deployed data by hand too).
2. `apps/payload-solutions/src/lib/docs-source.ts` SOURCE_PATHS: `'/docs/plugins/vercel-integration': 'packages/plugin-vercel'`.
3. `notes/plugin-vercel-spec.md`: implementation deviations — per-target runtime state is a hidden collection `vercel-targets` (partial patches under concurrency), not a global; `triggerWithOutcome()` reports whether the hook was actually called; `/history` populates `triggeredBy` at depth 1; extra endpoints `/document` and `/targets`.
