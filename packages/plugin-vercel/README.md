# @payload-solutions/plugin-vercel

Vercel Integration for Payload CMS. Your frontend is a separate Vercel project — Astro, a static Next export, a second Next app — and it has to be rebuilt when editors publish. This plugin gives editors a **Deploy** button on every admin page, shows **what is waiting to go live**, deploys **automatically one minute after the last change**, follows every deployment on Vercel, and can **cancel** or **roll back** from the same place. Nobody needs a Vercel login.

```ts
import { vercelPlugin } from '@payload-solutions/plugin-vercel'

vercelPlugin({
  targets: [{ slug: 'production', label: 'Website', hook: process.env.VERCEL_DEPLOY_HOOK_PRODUCTION, url: 'https://example.com' }],
  token: process.env.VERCEL_TOKEN, // optional: status, history, cancel, rollback
  collections: { pages: true, posts: true },
  globals: { header: true },
})
```

Docs: https://payload.solutions/docs/plugins/vercel-integration

## Install

```sh
pnpm add @payload-solutions/plugin-vercel
```

Peer dependencies: `payload ^3.88`, `@payloadcms/ui`, `@payloadcms/next`, `react`, `react-dom`. No runtime dependencies.

## What it does

- **Targets** — one deploy hook per site or environment (`production`, `staging`, a docs site). The Vercel project id is read from the hook URL. A target whose env var is unset shows as *not configured* and never throws.
- **Pending changes** — `afterChange`/`afterDelete` hooks on the collections and globals you opt in record one row per document per target (a document saved twenty times is one row). Collections with drafts count publishes and unpublishes only. The admin header shows "3 changes · deploying in 0:42"; every tracked document carries a *Not deployed yet* / *Live* pill.
- **Automatic deploys** — changes open a debounce window (60 s quiet period, 10 min max wait). The window is fired by any *tick*: the header widget's own status poll, a `sendBeacon` when the tab closes, the `vercel:tick` scheduled task, or `POST /api/vercel/tick` from a cron — so it works on Vercel Hobby (whose cron runs once a day) with zero extra infrastructure.
- **Ledger** — every trigger is a row in `vercel-deployments` with who, why, what changed (capped summary), and, with a token, the Vercel deployment id, state, URL, duration and error. Bounded by retention (90 days / 200 rows per target).
- **Failure semantics** — a failed or canceled build puts its changes back into pending; a rollback re-instates everything newer than the restored deployment. A build that Vercel canceled because a newer hook call arrived is marked *superseded*, not failed.
- **Status** — with `VERCEL_TOKEN`: polling (`/v7/deployments`, `/v13/deployments/{id}`) plus an optional signed webhook receiver (`POST /api/vercel/webhook`, HMAC-SHA1 `x-vercel-signature`, Pro/Enterprise accounts).
- **Admin** — header widget (`admin.components.actions`), Deployments view (`/admin/deployments`), document pill (`beforeDocumentControls`), and the deployments collection list. Built from `@payloadcms/ui` components.
- **Local API** — `payload.vercel.deploy()`, `.status()`, `.pending()`, `.markChanged()`, `.pause()`, `.cancel()`, `.rollback()`, `.tick()`.

## Development

```sh
pnpm dev:mock-vercel   # mock Vercel on :3399 (deploy hooks, deployments API, cancel, rollback)
pnpm dev               # admin on :3400, dev@payloadcms.com / test — copy dev/.env.example to dev/.env first
pnpm test:unit         # pure logic
pnpm test:int          # real Payload + sqlite against the mock
pnpm test:e2e          # Playwright, starts both servers
```

Vercel is a trademark of Vercel, Inc. This plugin is not affiliated with or endorsed by Vercel.
