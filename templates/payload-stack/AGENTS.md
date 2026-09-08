<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Payload Stack

This project was scaffolded with `npx create-payload-stack`. It is a SaaS on Payload CMS 3 + Next.js 16 with Better Auth (via `payload-auth`), organizations (Better Auth organization plugin bridged into `@payloadcms/plugin-multi-tenant`), Stripe subscriptions (`@better-auth/stripe`), shadcn/ui and Better Auth UI. Documentation: https://payload.solutions/docs/payload-stack

## Where things are

- `src/stack.config.ts`: the single product config (name, auth methods, organizations, plans, legal). Validated by `src/lib/stack.ts`. Read `stack.features.*` instead of re-deriving flags.
- `src/consent/`: the seam for legal pages and cookie consent. Both branches export the same names (`consentPlugins`, `legalCollections`, `seedLegal`, `ConsentHead`, `ConsentRoot`, `ConsentSettingsLink`, `LegalPageContent`, `LegalSetupNotice`), so `payload.config.ts`, the frontend layout, the footer, `/legal/[slug]` and the homepage never change with the answer. Change the seam, not the call sites.
- `src/payload.config.ts`: Payload config. Plugin order matters: `betterAuthPlugin` first (it generates users/sessions/accounts/organizations/members/subscriptions), then `multiTenantPlugin` pointed at `organizations`.
- `src/lib/auth/options.ts`: Better Auth server options derived from the config. `nextCookies()` must stay last.
- `src/lib/auth/auth-client.ts`: Better Auth browser client. `src/components/providers.tsx`: TanStack Query + next-themes + Better Auth UI provider; plugin list derived from config.
- `src/tenancy/sync-memberships.ts`: keeps `users.tenants[]` in sync with Better Auth `members`. Always pass `req` to nested Payload operations inside hooks (transactions).
- `src/lib/tenancy.ts`: `tenantScope()` / `tenantData()` for tenant-scoped queries and writes from server code. `src/lib/ids.ts`: Better Auth ids are strings, Payload ids may be numbers; normalize with `toPayloadId`.
- `src/lib/paths.ts`: every route. Better Auth UI base paths are set here too (`/admin` belongs to Payload).
- `src/components/ui/*`: shadcn/ui (radix-nova). `src/components/auth/*`: Better Auth UI components installed from its shadcn registry; treat as vendored.
- `src/emails/*`: transactional email. Rendered with React Email, sent through Payload's email adapter (Resend in production).
- `src/collections/Projects.ts`: example tenant-scoped collection. Copy its pattern for real collections.

## Conventions

- Server components read data through Payload's local API (`getPayloadClient()`), scoped with `tenantScope()`.
- Mutations are server actions next to their page (`actions.ts`), validated with zod.
- Secrets live in `.env` and are read only via `src/lib/env.ts`. Never import `env` from client components.
- After changing collections: `pnpm generate:types`. After changing admin components or plugins: `pnpm generate:importmap`.
- Tests: `pnpm test:unit` (Vitest, no database; every `stack.config.ts` option through `tests/helpers/stack-fixtures.ts` presets and `loadWithStack()`), `pnpm test:int` (Vitest against a real PostgreSQL: auth, organizations, tenant isolation), `pnpm test:e2e` (Playwright journeys against a dev server it starts on `E2E_PORT` with its own database, see `test.env`; `tests/e2e/global-setup.ts` creates the site admin). When a feature flag, plan, route or email changes, extend the matching spec and preset rather than deleting assertions. Guide: https://payload.solutions/docs/payload-stack/testing
