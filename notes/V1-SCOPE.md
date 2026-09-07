# Payload Stack v1 — scope and gap list (5 September 2026)

Audit of `main` at 0f24614 against a public v1 launch. Sizes: S = hours, M = a day or two, L = several days.

## Done and verified

- Template: Better Auth via payload-auth (email/password, magic link, passkeys, TOTP 2FA, social, impersonation, API keys, last-login badge); organizations (Better Auth org plugin bridged into multi-tenant; invitations, roles, switcher, optional teams); Stripe billing through @better-auth/stripe (plans from config, per user/org, seats, trials, portal, webhooks); shadcn `sidebar-08` dashboard; account, security and billing settings via better-auth-ui; onboarding; Projects as the tenant-scoped example; Payload admin with tenant selector and admin lockout for regular users; 9 React Email templates (Resend / console); legal-pages collection + seed; pricing page; minimal homepage; `stack.config.ts` (zod) + `env.ts` validation; Dockerfile + compose (Postgres, Mailpit); 8 integration + 4 Playwright tests.
- CLI `create-payload-stack` 0.1.1: prompts for name, database (5 adapters, swapped in payload.config.ts), auth methods/social, billing mode; `-y`; 11 tests; scaffold verified end to end on Postgres and SQLite.
- payloadstack.com: one-pager + /when-to-choose, both themes, mobile, OG image.
- payload.solutions: homepage from collections, roadmap, contact form, docs (12 Payload Stack pages, plugin stubs, Payload Clock intent).

## Must-have for v1

### Launch logistics (from HANDOFF.md)
1. GitHub repo public — the CLI downloads the template from codeload.github.com; private = 404 for every user. (S)
2. Publish `create-payload-stack` with npm trusted publishing (OIDC, GitHub Actions); create the `@payload-solutions` npm org first. (S, needs #10)
3. Deploy payloadstack.com and payload.solutions (Vercel; site build needs reachable DATABASE_URL). (S)
4. Send trademark request (notes/trademark-request-email.md + marks sheet). (S)
5. File the payload-auth `expiresAt` issue upstream. (S)

### Production-readiness gaps in the template
6. ~~**Media storage adapter.**~~ Done 2026-09-05: CLI prompt "Media storage" (Skip = local disk, then Vercel Blob, S3, R2 via S3 API, Azure, GCS, Uploadthing), `--storage` flag, adapter written between `storage-adapter` markers in payload.config.ts behind an `if (env.…)` guard (local disk until the variables are set, no schema change), package pinned to the payload version, all variables in .env.example and env.ts, docs page `storage.mdx`. Not in stack.config: storage is infrastructure like the database. `@payloadcms/storage-r2` (Workers binding) deliberately not offered.
7. **Plan limits enforcement.** `plans[].limits` and `seats` are declared, shown in pricing, and never enforced. Add `src/lib/entitlements.ts` (`getActivePlan(orgId)`, `assertWithinLimit(orgId, 'projects')`) and use it in the Projects create action so users have a copyable pattern. (M)
8. ~~**Frontend error surfaces.**~~ Done 2026-09-07: `(frontend)/not-found.tsx`, `error.tsx`, `global-error.tsx` and `dashboard/loading.tsx`. The two error boundaries report through the observability facade (#21) and show the Next.js `digest` as a reference the user can quote.
9. **SEO baseline.** `robots.ts` at app root, `sitemap.ts` (marketing + legal pages), default `metadata` with OG/Twitter in the frontend layout, `manifest.ts`. (S)
10. **CI.** `.github/workflows`: typecheck + lint + int tests on PR; e2e on main with Postgres service; publish workflow for the CLI with `id-token: write`. (M)
11. **Security headers** in next.config (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options for the frontend; admin needs frames off too). CSP deferred. (S)
12. **One real production deployment** of a scaffolded project (Vercel + Neon or Docker + Postgres) following only the docs, including `db:migrate:create` → `db:migrate`, Stripe webhook, Resend. Fix whatever the docs miss. (M)

### Observability (added 2026-09-07)
21. ~~**Error monitoring.**~~ Done 2026-09-07: provider-agnostic port in `src/lib/observability` (`captureError`, `captureMessage`, `identifyUser`, `flushObservability`, `withErrorReporting`, `withSpan`); adapters `none`, `console`, `sentry` (structural `SentryLike`, so the file compiles without the SDK) and a `custom` HTTP starting point; PII and secret scrubbing enforced in the facade, not the adapters; `observability` policy key in stack.config (sampleRate, tracesSampleRate, sendPII, environment) with the destination in `.env`. Wired through `src/instrumentation.ts` (`register` + `onRequestError`), `src/instrumentation-client.ts` (lazy import: no SDK in the bundle without a DSN), `@payloadcms/plugin-sentry` in payload.config behind `sentryReady`, and a conditional `withSentryConfig` in next.config behind `observability-adapter-*` markers for a future CLI prompt. Docs: `observability.mdx`. Tests: `tests/unit/observability.spec.ts`.
    Deliberately out: OpenTelemetry traces/metrics and pino log transports are documented, not coded (both are already vendor-neutral); no CLI prompt yet — the markers are in place for one; `identifyUser` is not called after sign-in yet.
    Open decision: `@payloadcms/plugin-sentry@3.88.0` still declares `@sentry/nextjs ^9`, whose admin `ErrorBoundary` would run against an uninitialised second client. Pinned with a `@sentry/nextjs: ^10.73.0` override in all three override fields; revisit when the plugin moves to v10.

### Privacy and analytics (decided direction, this conversation)
13. `analytics` key in stack.config: `{ provider: 'posthog' | 'google' | 'none', ... }`, default `none`; thin adapter (`<AnalyticsScripts />`, `track()`, `identify()` after login); CLI prompt that writes the value and adds the dependency. PostHog recommended in the prompt: EU region option, `cookieless_mode`. (M)
14. Minimal consent layer, shown only when a consent-gated category is enabled: two categories (necessary, analytics), cookie storage, shadcn banner + preferences dialog copied into the repo (OpenConsent-style, not a dependency), PostHog opt-in call, Google Consent Mode v2 signals when provider = google. (M)
15. Better legal seeds: Terms from Common Paper ToS (CC BY 4.0, B2B) and Privacy + Cookie Policy from General Legal (CC0, GDPR-enhanced), fields filled from stack.config; cookie policy reflects the analytics choice. Extend `stack.legal` with `address`, `jurisdictions[]`, `dpo?`. Keep the "not legal advice" note. (M)
16. Make the seeded privacy text true: it promises "export or delete your account from settings". Delete exists; add a JSON account-data export (or remove the sentence). (S)

### Docs and housekeeping
17. New docs pages: legal pages & privacy, analytics, ~~storage~~ (done), testing, entitlements; update configuration.mdx for the new keys. (M)
18. CHANGELOG for template and CLI; the CLI already stamps `payload-stack` version into the scaffold. (S)
19. Roadmap honesty on payload.solutions: "Payload Clock beta — in progress, Q4 2026" has no code; move to planned or drop the quarter. Add the consent plugin as planned to test demand. (S)
20. Template folder has no LICENSE file; state MIT in the template README (scaffolded projects need none). (S)

## Explicitly not v1

- `@payload-solutions/plugin-consent` (extract from the template after v1; see conversation notes), plugin-emails, plugin-vercel, plugin-action-scheduler, Payload Clock.
- Umami / Plausible analytics providers (design the adapter so they slot in).
- i18n, CSP, audit log, feature flags, admin dashboard widgets, `packages/ui` extraction, template update/upgrade mechanism, Payload 4.
- PolicyStack as a dependency (evaluated 2026-09-05; not adopted).

## Suggested order

Week 1: #6 #7 #8 #9 #11 (template hardening) → #10 (CI) → #12 (real deploy, fixes).
Week 2: #13 #14 #15 #16 (privacy/analytics) → #17 #18 #19 #20 (docs) → #1–#5 (go public).
