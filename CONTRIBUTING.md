# Contributing to Payload Solutions

Thanks for helping. This repository holds Payload Stack, the `create-payload-stack` CLI, the `@payload-solutions/*` plugins, and the payload.solutions, payloadstack.com and payloadclock.com websites. Everything here is MIT licensed, and so is everything you contribute.

This guide covers how to report problems, propose changes, and get a pull request merged.

## Before you start

- **Bugs:** open an issue with the package and version, your Payload and Node versions, the database adapter, the steps to reproduce, and what you expected. A minimal reproduction (a scaffolded Payload Stack or a plugin `dev/` app) gets fixed first.
- **Features and larger changes:** open an issue first and describe the problem, not only the solution. Changes to `stack.config.ts`, a CLI prompt or flag, a plugin's public options, or a seam's exports affect every user, so agree on the shape before writing code.
- **Small fixes** (typos, docs, an obvious bug with a test): open a pull request directly.
- **Security issues:** do not open a public issue. Report privately through GitHub's [private vulnerability reporting](https://github.com/mpresecan/payload-solutions/security/advisories/new).

## Repository layout

| Path                                               | What                                                                     | Ships as                          |
| -------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------- |
| `templates/payload-stack`                          | Payload Stack, the SaaS boilerplate                                      | Downloaded by the CLI             |
| `templates/payload-stack/variants/*`               | The plugged-in branch of each optional step (consent, emails, scheduler) | Moved into place by the CLI       |
| `packages/create-payload-stack`                    | The scaffolding CLI                                                      | npm `create-payload-stack`        |
| `packages/plugin-*`                                | Payload plugins, each with its own `dev/` app                            | npm `@payload-solutions/plugin-*` |
| `packages/consent-core`, `packages/consent-react`  | Consent runtime used by the consent plugin                               | npm `@payload-solutions/*`        |
| `packages/brand`                                   | Shared mark, wordmarks, tokens, motion primitives                        | Internal                          |
| `apps/payload-solutions`                           | payload.solutions, renders `docs/`                                       | Vercel                            |
| `apps/payload-stack-web`, `apps/payload-clock-web` | Marketing sites                                                          | Vercel                            |
| `docs/`                                            | MDX documentation for every product and plugin                           | payload.solutions/docs            |

## Development setup

Requirements: Node 22.12+ (see `.nvmrc`), pnpm 10+, and Docker for the Payload Stack integration and end-to-end suites.

```bash
git clone https://github.com/<you>/payload-solutions.git
cd payload-solutions
corepack enable && corepack prepare pnpm@10.28.0 --activate
pnpm install
```

Use pnpm only. Do not commit a `package-lock.json` or `yarn.lock`.

### Payload Stack (template)

```bash
cd templates/payload-stack
cp .env.example .env
docker compose up -d     # PostgreSQL, test databases, Mailpit on :8025
pnpm dev                 # :3000 — app at /, dashboard at /dashboard, admin at /admin
```

Read `templates/payload-stack/AGENTS.md` before changing the template. Its "Rules that are easy to break" section is binding for contributions: tenant scope on every privileged call, plugin order, `req` in nested hook operations, routes from `src/lib/paths.ts`, and **change the seam, not the call sites**. A change to an optional step must land in both branches: `src/` and the matching `variants/<step>`, with the same exports.

### create-payload-stack (CLI)

```bash
pnpm --filter create-payload-stack build
node packages/create-payload-stack/dist/index.js my-app --local-template templates/payload-stack --no-install
pnpm --filter create-payload-stack test
```

A new prompt needs a matching flag, a default for `-y`, a test, and an entry in `docs/payload-stack/cli.mdx`.

### Plugins

Each plugin runs inside its own Payload app in `dev/` (SQLite by default):

```bash
cd packages/plugin-emails
cp dev/.env.example dev/.env
pnpm dev
```

| Plugin                   | Dev port |
| ------------------------ | -------- |
| plugin-emails            | 3300     |
| plugin-action-scheduler  | 3310     |
| plugin-consent           | 3320     |
| plugin-vercel            | 3400     |
| plugin-resend-broadcasts | 3500     |

After changing a collection, field or admin component, run `pnpm generate:types` and `pnpm generate:importmap` and commit the results. Keep `peerDependencies` on `payload` and `@payloadcms/*` as ranges; do not pin them.

### Websites and docs

```bash
pnpm dev:solutions       # payload.solutions on :3200 (renders docs/)
pnpm dev:stack-web       # payloadstack.com on :3100
pnpm dev:clock-web       # payloadclock.com
```

Shared visuals and motion belong in `packages/brand`, not in a single app. When you add a docs page, register it in the folder's `meta.json`.

## Making a change

1. Fork the repository and branch from `main`: `fix/<short-topic>`, `feat/<short-topic>`, or `docs/<short-topic>`.
2. Keep one concern per pull request. Unrelated formatting or refactors go in their own PR.
3. Add or extend tests (see below). Do not delete or loosen a test to make a change pass.
4. Update documentation in `docs/` and the package `README.md` when behaviour, options or flags change.
5. Run the checks for what you touched:

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm --filter payload-stack verify          # template: typecheck, lint, unit
pnpm --filter <package> test                # any package you changed
```

6. Look at UI changes in a browser with the dev server running. Type-checking is not enough.

## Tests

| Suite                                                               | Where                                | Run                                       | Needs                         |
| ------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------- | ----------------------------- |
| Template unit (every `stack.config.ts` option)                      | `templates/payload-stack/tests/unit` | `pnpm --filter payload-stack test:unit`   | Nothing                       |
| Template integration (auth, organizations, tenancy, access, emails) | `templates/payload-stack/tests/int`  | `pnpm --filter payload-stack test:int`    | `docker compose up -d`        |
| Template end-to-end (Playwright user journeys)                      | `templates/payload-stack/tests/e2e`  | `pnpm --filter payload-stack test:e2e`    | Docker; starts its own server |
| CLI (every flag, database and storage adapter, real scaffold)       | `packages/create-payload-stack`      | `pnpm --filter create-payload-stack test` | Nothing                       |
| Plugin unit, integration, e2e                                       | `packages/plugin-*`                  | `test:unit`, `test:int`, `test:e2e`       | Nothing beyond the `dev/` app |

Match the test to the change: access control, tenancy, auth or hooks → integration; a page or user flow → end-to-end; config parsing or a pure function → unit. CI runs the template unit, integration and end-to-end suites and the CLI suite on every pull request.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org) with a scope when one package is affected:

```
fix(plugin-emails): keep draft copy when a test send fails
feat(create-payload-stack): add --storage gcs
docs(payload-stack): document trial reminders
```

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `style`, `chore`. Write the subject in the imperative and say what changed for the user, not which file you edited. Mark breaking changes with `!` (`feat(plugin-vercel)!: …`) and explain the migration in the body.

## Pull requests

- Fill in what changed, why, and how you verified it. Link the issue (`Closes #123`).
- Include screenshots or a short recording for any visible change.
- State anything you could not verify.
- CI must be green. A maintainer reviews, may ask for changes, and squash-merges.
- Do not bump package versions or edit changelogs in your PR. Maintainers release.

## Releases

Packages are versioned independently under semver and published by maintainers. While a package is below `1.0.0`, a minor bump may contain breaking changes; they are always called out in the release notes. Payload Stack template versions are tied to the CLI release that downloads them.

## Documentation

All product and plugin documentation lives in `docs/` and is served at [payload.solutions/docs](https://payload.solutions/docs). Write for someone installing the package for the first time: what it does, how to install it, the options with their defaults, and one working example. Keep code samples runnable against the current version.

## AI-assisted contributions

Coding agents are welcome; the template ships `AGENTS.md` and skills for them. You are responsible for every line you submit: read it, run the checks, and verify behaviour in a browser where relevant. Do not commit files generated only for your agent session.

## Trademark

Payload, the Payload design, and related marks are trademarks of Payload CMS, Inc. Payload Solutions is an independent project and is not affiliated with, sponsored by, or endorsed by Payload CMS, Inc. Do not add Payload CMS marks or imply endorsement in code, docs or assets.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
