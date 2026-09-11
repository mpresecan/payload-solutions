# Handoff: payload-ecosystem, 4 September 2026

Everything in this repo was built and verified in a cloud workspace (Node 22, pnpm 10.28, local Postgres 16). The tree, including git history on `main`, was then copied to `~/Projects/payload-ecosystem`. `node_modules`, `.next`, `.turbo` and `.source` were not copied; the first step on the Mac is an install.

## First run on the Mac

```bash
cd ~/Projects/payload-ecosystem
nvm use                                   # .nvmrc = 22
corepack enable && corepack prepare pnpm@10.28.0 --activate
pnpm install
pnpm turbo run typecheck lint test --filter=!payload-stack   # template tests need a database, see below

git remote add origin git@github.com:mpresecan/payload-solutions.git
git push -u origin main
```

Databases: two local Postgres databases, `payload_stack` (template, port 3000) and `payload_solutions` (site, port 3200). `templates/payload-stack/docker-compose.yml` starts Postgres and Mailpit for the template; the site only needs `createdb payload_solutions`. Each app has an `.env.example`; copy to `.env` and set `DATABASE_URL` and `PAYLOAD_SECRET`.

| Command | What |
| --- | --- |
| `pnpm dev:stack-web` | payloadstack.com on :3100, static, no database |
| `pnpm dev:solutions` | payload.solutions on :3200, admin at /admin (create the first user there) |
| `pnpm --filter payload-stack dev` | the boilerplate on :3000, admin at /admin (payload-auth redirects to first-admin setup) |
| `pnpm --filter create-payload-stack build && node packages/create-payload-stack/dist/index.js demo --local-template templates/payload-stack` | scaffold a project from the local template |
| `pnpm --filter payload-stack test:e2e` | Playwright; run `pnpm exec playwright install chromium` in the template once |

## What is verified

- Template: typecheck, lint, 8 integration tests, 4 Playwright e2e tests (sign-up, onboarding, dashboard, admin lockout); the full browser flow also passed on SQLite through the CLI.
- CLI: 11 unit tests; a scaffolded project (`--local-template`) installs, typechecks, runs and passes the flow end to end.
- payloadstack.com: builds, both themes, mobile, OG image.
- payload.solutions: builds (27 routes), homepage from seeded collections, docs at /docs/* with search and sitemap, contact form writes to `contact-submissions`, admin works.

## Before going public

1. **Make the GitHub repo public.** `create-payload-stack` downloads `templates/payload-stack` from `codeload.github.com/mpresecan/payload-solutions/tar.gz/main`; a private repo returns 404 for users. Until then, `--local-template` works.
2. **Publish the CLI.** `pnpm --filter create-payload-stack build && cd packages/create-payload-stack && npm publish --access public`. Reserve the `@payload-solutions` npm scope (create the org on npmjs.com) before publishing plugins.
3. **Trademark.** Send `notes/trademark-request-email.md` with `notes/payload-solutions-marks.png` to info@payloadcms.com. Attribution and independence notices are already in every footer and README.
4. **Deploy.** Both apps are Vercel-ready (`apps/payload-stack-web`, `apps/payload-solutions`; set the root directory per project). The site needs `DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SITE_URL=https://payload.solutions`, optionally `RESEND_API_KEY` and `CONTACT_NOTIFY_EMAIL`. The homepage is prerendered, so the database must be reachable during the build.
5. **payload-auth issue to file.** payload-auth 3.0.0 creates the first-admin invitation without the required `expiresAt`, so the first-admin flow fails on Postgres. The template works around it with `adminInvitations.collectionOverrides` (defaults `expiresAt` to +7 days) in `src/payload.config.ts`. Worth an upstream issue at github.com/payload-auth/payload-auth with that description.
6. **Stripe / Resend.** The template runs without either (billing UI hidden, emails logged). For production set the keys listed in `templates/payload-stack/.env.example` and create one product per plan with monthly and yearly prices; the price ids go into `NEXT_PUBLIC_STRIPE_PRICE_*`.

## Where things are

- `packages/brand`: names, domains, GitHub URL, trademark strings, `Logo`/`Mark`, CSS tokens, the isometric `IsoStack` illustration. Change a name or domain here and both sites follow.
- `templates/payload-stack`: the boilerplate. `src/stack.config.ts` is the one file a user edits; `src/tenancy/sync-memberships.ts` is the Better Auth to multi-tenant bridge.
- `packages/create-payload-stack`: the CLI. Database adapters are swapped between the `// database-adapter-*` markers in the template's `payload.config.ts`.
- `docs/`: all MDX documentation, rendered by `apps/payload-solutions` at /docs/*. Navigation is `meta.json` per folder.
- `notes/`: internal drafts, not published.

## Later

- Payload Clock (payloadclock.com) is deferred; `docs/payload-clock/index.mdx` and the roadmap item describe the intent.
- Shared marketing components (button, reveal, copy-command, brand-icon) exist in both apps; move them into a `packages/ui` when a third site appears.

## Payload Consent plugin (added 6 September 2026)

`packages/plugin-consent` (`@payload-solutions/plugin-consent`) was scaffolded with `npx create-payload-app -t plugin` and follows that layout: `src/` is the plugin, `dev/` is a Next.js + Payload app that uses it (SQLite file, seeded categories/trackers/legal pages, plain banner, `/legal/[slug]`). Siblings: `packages/consent-core` (framework-agnostic store, cookie codec, Consent Mode v2, GPC, loader) and `packages/consent-react` (provider, hooks, `ConsentGate`, Next helpers, shadcn registry block in `registry/`). Spec: `notes/plugin-consent-spec.md`. Docs: `docs/plugins/payload-consent.mdx`. Catalogue + roadmap seeds in `apps/payload-solutions/src/seed/index.ts` list it as available.

Verified in the cloud workspace (Payload 3.88, Next 16.3, SQLite): plugin + dev-app typecheck, template build (tsc declarations + swc), 13 integration tests (`pnpm test:int`, vitest through the template harness), 4 Playwright e2e (`pnpm test:e2e`: admin login + Privacy group + dashboard widget; DE banner → accept → record → gate → reload → preferences revoke; cookie policy with generated table; US opt-out), consent-core 23 unit tests, consent-react 4 tests. Not yet run on the Mac: `pnpm install` needs file-delete permission in the Cowork session (pnpm unlinks temp files); run it locally, then `cd packages/plugin-consent && cp dev/.env.example dev/.env && pnpm dev` (port 3000; admin dev@payloadcms.com / test), `pnpm test:int`, `pnpm exec playwright install chromium && pnpm test:e2e`.

Conventions to keep: relative imports carry `.js` extensions (NodeNext) in all three packages; sibling packages expose `src/` in `exports` and `dist/` in `publishConfig` (template pattern); plugin slugs are typed as `CollectionSlug`/`GlobalSlug` and local-API results cast to `AnyDoc`, so the plugin compiles against any host's generated types; `pnpm dev` uses webpack (`--webpack`) because Turbopack does not resolve the template's `.js → .tsx` convention across the workspace (`pnpm dev:turbo` exists to re-test); the inline Consent Mode default script is idempotent (`window.__plConsentModeDefault`) because Next renders it twice in dev. `_to_delete/plugin-consent-previous/` holds the pre-template files (tsup config, old tests) — safe to delete. Next steps: wire into Payload Stack (`stack.config.ts` `privacy`/`analytics` keys, drop the template's own LegalPages collection), host the shadcn registry at payload.solutions/r/, publish under `@payload-solutions/*`.

### Update — 7 September 2026: tables, processor register, DPA

**Lexical tables.** `legalPagesEditor()` now enables `EXPERIMENTAL_TableFeature`, so seeded GFM pipe tables convert to real table nodes instead of literal `| --- |` text, and editors get table controls. `src/components/RichTextTable.tsx` replaces Lexical's inline-styled JSX converter with a semantic one (`thead`/`tbody`, `scope`d `th`, scroll wrapper, no hard-coded colours). Spread `legalPageConverters` — tables plus all three blocks; `consentBlockConverters` is blocks-only. Re-run `generate:importmap` after upgrading or the admin errors on a legal page.

**Processor register** (`consent-processors`). Trackers cover the browser only; hosting, database, email, error tracking and payments never touch the banner. The register is the superset, and one collection feeds four outputs: recipients table (privacy §4, GDPR Art. 13(1)(e)), transfers table (§5, Art. 13(1)(f)), the public sub-processor page (Art. 28(2) general written authorisation) and DPA Annex III. 28 presets in `src/seed/processor-presets.ts`, seeded **unverified** on purpose — vendors contract through regional entities and the published entity has to match the contract actually signed. `role` distinguishes processor / sub-processor / independent-controller / joint-controller (Stripe is an independent controller, not our processor). `adequacy` and `dpf` rows carry an SCC `fallback`, so a Schrems III annulment is a documentation change rather than an unlawful transfer.

**Two version clocks.** `subprocessorsVersion` lives under Consent settings → Processors and is deliberately outside `policyVersion`: swapping an email provider is a notice obligation to B2B customers, not a reason to re-prompt every visitor. `GET /api/consent/subprocessors` returns the list, version, notice settings and change log for customer tooling to diff.

**Seeded documents are now five**: privacy (with real tables), cookies, terms, Sub-processors, and a DPA modelled on the Common Paper DPA (CC BY 4.0) + EU SCC annex structure. Annex II TOMs are a bracketed checklist that must be replaced — an inaccurate Annex II is a false contractual representation.

**Bugs fixed along the way.** `resolveJurisdictionModel` used `.find()` over the override table with built-in defaults prepended, so an editor's `US → notice` row could never take effect; now `lastOverride` searches from the end (regression test in `consent-core/test/jurisdiction.test.ts`). `package.json` exported `./client` at a file that never existed — removed. `getPluginOptions` is now re-exported from `/server`.

**Verified:** 19 integration, 7 e2e, 24 consent-core, 4 consent-react, three typechecks, three builds. Dashboard warns on unverified rows, missing DPA links, sub-processors with no "since" date, and **trackers missing from the register** — the drift this whole design exists to prevent.

**Docs** are now a ten-page section at `docs/plugins/payload-consent/` (the old single `payload-consent.mdx` was moved to `_to_delete/payload-consent-single-page.mdx`; a page and a folder cannot share a slug). New page: `processors.mdx`.

**Still open:** sub-processor change *emails* (log + endpoint exist, sending does not); an Art. 30 RoPA export; `pnpm install` on the Mac.

## Payload Action Scheduler plugin (added 11 September 2026)

`packages/plugin-action-scheduler` (`@payload-solutions/plugin-action-scheduler`, 0.1.0, published 11 September 2026) follows the `create-payload-app -t plugin` layout: `src/` is the plugin, `dev/` a Next + Payload app on SQLite (`pnpm dev` → :3310, dev@payloadcms.com / test). Spec: `notes/plugin-action-scheduler-spec.md`; docs: `docs/plugins/payload-action-scheduler/`. Architecture: a `scheduled-actions` ledger is the source of truth, each due action runs as a Payload job `scheduler:run` carrying only `{ actionId }`, claims and outcomes are atomic compare-and-set statements (`src/db/cas.ts`), a `scheduler:tick` task promotes/sweeps/purges. The admin view is Payload's list view plus `beforeListTable` (queue strip, PillSelector tabs, log Drawer), custom cells, a ui-field row menu (Popup) and `listMenuItems` bulk actions. Not yet done on the Mac: `pnpm install` (the package's node_modules are hand-made symlinks), `pnpm test:int`, `pnpm test:e2e`, a look at the dev app; 64 unit tests pass (`pnpm test:unit`).
