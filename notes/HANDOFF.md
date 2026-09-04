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
- Plugins (`@payload-solutions/plugin-emails`, `plugin-vercel`, `plugin-action-scheduler`) have docs stubs and roadmap entries, no code yet. They belong in `packages/plugin-*`.
- Shared marketing components (button, reveal, copy-command, brand-icon) exist in both apps; move them into a `packages/ui` when a third site appears.
