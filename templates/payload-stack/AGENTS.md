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
- `src/emails/*`: transactional email. Rendered with React Email, sent through Payload's email adapter (Resend in production). `src/emails/hooks.ts` is a seam too: `emailsEnabled`, `notify`, `sendTrialReminder` and `sendPaymentReminder` exist in both branches, and are how anything else asks for a message without knowing whether the catalogue is there.
- `src/scheduler/`: the seam for scheduled and recurring actions. Both branches export the same names (`schedulerPlugins`, `schedulerJobs`, `withStripeEvents`, `withTrialCallbacks`), so `payload.config.ts` and `src/lib/auth/options.ts` never change with the answer. The two wrappers compose over the email bundles rather than sitting beside them, because both plugins want `stripe({ onEvent })`. `src/scheduler/actions/*` is the catalogue, gated on `stack.features.*` and on `emailsEnabled`; `src/scheduler/jobs.ts` is the runner and the cron-secret gate on `/api/payload-jobs/run`.
- `src/collections/Projects.ts`: example tenant-scoped collection. Copy its pattern for real collections.

## Commands

| Command | When |
| --- | --- |
| `pnpm dev` | Dev server on :3000. App at `/`, dashboard at `/dashboard`, Payload admin at `/admin`. |
| `pnpm verify` | Typecheck, lint and unit tests. Run it before you say a change is done. |
| `pnpm generate:types` | After changing a collection, global, field or plugin option. |
| `pnpm generate:importmap` | After adding or moving an admin component, or adding a plugin. |
| `pnpm db:migrate:create <name>` | After a schema change that must reach a production SQL database. |
| `pnpm test:int` | Access control, tenancy, auth or hooks changed. Needs `docker compose up -d`. |
| `pnpm test:e2e` | A page or a user flow changed. Starts its own server and database. |

## Definition of done

1. The change follows the seams and rules below; nothing was re-derived that `stack.config.ts` already says.
2. Generated files are current (`payload-types.ts`, the admin import map).
3. The matching tests were extended (see the `stack-tests` skill) and `pnpm verify` passes.
4. UI changes were looked at in a browser with the dev server running, not only type-checked.
5. Anything you could not verify is said plainly in your summary.

## Rules that are easy to break

- **Tenant scope on every privileged call.** Frontend server code uses the local API with `overrideAccess: true`, so the `where` must include `await tenantScope()` and creates must spread `await tenantData()`. Update and delete by `where`, never by a bare id. Everywhere else (endpoints, hooks acting for a user) prefer `overrideAccess: false` and pass `user`.
- **New tenant-scoped collection = two registrations:** `payload.config.ts` `collections` and `TENANT_SCOPED_COLLECTIONS` in `src/tenancy/cleanup.ts`. The second feeds the multi-tenant plugin and the organization-delete cleanup.
- **Pass `req`** to nested Payload operations inside hooks, or they run outside the transaction.
- **Organizations may be off.** Name `organizations`, `members` and `invitations` through `src/lib/org-collections.ts`, never as literals, and gate code on `stack.features.organizations`.
- **Change the seam, not the call sites.** `src/consent`, `src/emails/hooks.ts` and `src/scheduler` export the same names whether or not their plugin is installed. Feature code imports from the seam, never from `@payload-solutions/plugin-*` directly.
- **Plugin order:** `betterAuthPlugin` first, then `multiTenantPlugin`. `nextCookies()` stays last in the Better Auth plugins. Never add a second `stripe({ onEvent })`; compose through `withStripeEvents`.
- **Routes come from `src/lib/paths.ts`.** `/admin` belongs to Payload.
- **Do not edit vendored code:** `src/components/auth/*` (Better Auth UI) and `src/components/ui/*` (shadcn; add components with `pnpm dlx shadcn@latest add`).
- **Do not delete or loosen a test to make a change pass.**

## Skills

Task recipes live in `.claude/skills/` (Claude Code, Cursor) and `.agents/skills/` (Codex, Cursor), whichever this project was scaffolded with. Read the matching one before starting:

- `stack-collection`: add a collection, especially one owned by an organization or user.
- `stack-dashboard-page`: add a dashboard page, server action or sidebar link.
- `stack-email`: add or send a transactional email (either email branch).
- `stack-scheduled-action`: run something later or on a schedule.
- `stack-tests`: which suite, which helpers, how to cover every `stack.config.ts` option.
- `payload`: Payload CMS 3 itself (fields, hooks, access control, queries), from Payload's own repository.

## Tools

`.mcp.json` (Claude Code) and `.cursor/mcp.json` (Cursor) configure MCP servers for this project, when present:

- `next-devtools`: routes, build and runtime errors, and logs from the running `pnpm dev` server.
- `playwright`: drive a real browser to check a page after a change.
- `shadcn`: browse and add registry components.
- `payload-consent` (with Payload Consent): audit the legal pages against what the app actually loads.

## Conventions

- Server components read data through Payload's local API (`getPayloadClient()`), scoped with `tenantScope()`.
- Mutations are server actions next to their page (`actions.ts`), validated with zod, and call `requireSession()` themselves.
- Secrets live in `.env` and are read only via `src/lib/env.ts`. Never import `env` from client components.
- After changing collections: `pnpm generate:types`. After changing admin components or plugins: `pnpm generate:importmap`.
- Tests: `pnpm test:unit` (Vitest, no database; every `stack.config.ts` option through `tests/helpers/stack-fixtures.ts` presets and `loadWithStack()`), `pnpm test:int` (Vitest against a real PostgreSQL: auth, organizations, tenant isolation), `pnpm test:e2e` (Playwright journeys against a dev server it starts on `E2E_PORT` with its own database, see `test.env`; `tests/e2e/global-setup.ts` creates the site admin). When a feature flag, plan, route or email changes, extend the matching spec and preset rather than deleting assertions. Guide: https://payload.solutions/docs/payload-stack/testing
