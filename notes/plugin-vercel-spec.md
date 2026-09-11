# Vercel Integration plugin for Payload — technical specification

| | |
| --- | --- |
| Working name | `@payload-solutions/plugin-vercel` (product name "Vercel Integration"; descriptive use of the Vercel name, see §17.4) |
| Status | Draft, 11 September 2026. No code yet. Decisions taken with Michael on 11 September are marked **Decided**; the rest is proposal. |
| Scope | Payload 3.x plugin: trigger Vercel deploy hooks for one or more targets from the admin, the local API and automatically after content changes (debounced); track what changed since the last deployment; resolve, show and act on deployment status through the Vercel REST API and webhooks |
| Reference implementation | `strapi-plugin-vercel-deploy` (MIT; deploy button + polled deployment list + token) — the shape is ported, the rest is new |
| Related | `docs/plugins/vercel-integration/index.mdx` (public stub), `notes/plugin-action-scheduler-spec.md` (the size rule, tick/runner model, format precedent), `notes/plugin-emails-spec.md` (package layout precedent), `docs/payload-clock/index.mdx` (hosted runner) |
| Verified against | Payload `v3.88.0` as installed in this monorepo (`payload/dist/config/types.d.ts`, `collections/config/types.d.ts`, `admin/views/index.d.ts`, `queues/localAPI.d.ts`, `queues/config/types/index.d.ts`); Vercel docs fetched 11 September 2026: deploy hooks, webhooks + webhooks API, request headers (`x-vercel-signature`), REST API deployments and projects groups, cron usage & pricing |
| License | MIT |

---

## 1. Summary

A headless Payload site usually has a frontend that is built and hosted separately on Vercel — Astro, a static Next export, a second Next app, Hugo. When an editor publishes a page, that frontend has to be rebuilt, and `revalidatePath` cannot reach a different project. Vercel solves the rebuild with deploy hooks; nobody has solved the editor's side of it for Payload: knowing that the site is behind, what exactly is waiting, pressing one button, seeing the build finish or fail, and undoing a bad release. That is what this plugin is.

Configuration is code and environment: a list of **targets** (a deploy hook URL each, optionally a project on the same or another Vercel team) and the collections and globals whose changes should reach them. From then on the plugin records every change to those documents in a small **changes** collection, one row per document per target, and shows the count in the admin header. It triggers a deployment when an editor presses **Deploy**, when application code calls `payload.vercel.deploy()`, or automatically **60 seconds after the last change** (Decided), so a session of twenty saves produces one build. Every trigger is a row in a small **deployments** ledger; with a `VERCEL_TOKEN` the row is matched to the real Vercel deployment and follows it from queued to ready or error, with cancel and instant rollback from the same view; without a token the plugin still triggers and still counts changes.

The ledger obeys the same size rule as the Action Scheduler: scalars and short capped summaries only, no logs, no payloads, bounded retention (§7.4).

## 2. What is being ported, and what is new

| strapi-plugin-vercel-deploy | This plugin | Notes |
| --- | --- | --- |
| One `deployHook` + `apiToken` in plugin config | `targets[]`, each with its own hook; token optional and shared or per target | Multi-site and production/staging from one admin. |
| `appFilter` / `teamFilter` to find deployments | `projectId` parsed from the hook URL; `teamId` optional | A hook URL is `https://api.vercel.com/v1/integrations/deploy/{projectId}/{hookId}`, so the project is known without extra config. |
| Home page: Deploy button + polled list of deployments | Header widget on every admin page, Deployments view, read-only history collection | The button is where the editor is, not on a separate page. |
| Settings page (roles) | `access.deploy` / `access.rollback` / `access.read` functions | Payload access control, not a role list. |
| Deploy on demand only | Automatic, debounced deploys per collection/global, with pause | New. |
| No notion of what changed | Pending-changes ledger, badge, per-document "not deployed yet" pill | New (Decided for 0.1). |
| Status by polling only | Polling plus signed Vercel webhooks (Pro/Enterprise) | New. |
| No cancel, no rollback | Cancel in-flight, instant rollback to a previous production deployment | New (Decided for 0.1). |

## 3. Goals and non-goals

Goals:

- An editor can see, on any admin page, whether the live site is up to date, deploy it with one click, and watch the result.
- Automatic deployments that coalesce an editing session into one build, without a queue worker or cron being a prerequisite (§9.3).
- A history that answers "who deployed what, when, and did it work" — bounded in size by construction.
- Correct behaviour on failure: a failed or canceled build puts its changes back into "pending"; a rollback does the same for everything newer than the restored deployment.
- Zero-token mode that is still useful; token mode that uses only documented Vercel endpoints.
- Works whether Payload runs on Vercel, in Docker, or elsewhere, and whether the frontend is the same Vercel project or another.

Non-goals:

- Replacing ISR. When Payload and the frontend are one Next project, `revalidatePath`/`revalidateTag` in `afterChange` hooks is the right tool and the docs say so; the plugin is for full rebuilds and for other projects.
- Netlify, Cloudflare Pages, GitHub Actions dispatch. **Decided:** Vercel only, no provider abstraction. Vercel's types are used directly.
- Managing Vercel itself: domains, environment variables, project settings, logs. The view links to the Vercel dashboard for those.
- Preview deployments per document (Payload live preview covers previewing; a preview-branch target is just another target).
- Storing build logs. `GET /v3/deployments/{id}/events` exists; the plugin links to `inspectorUrl` instead.

## 4. Verified Vercel facts that shape the design

| Fact | Source | Consequence |
| --- | --- | --- |
| A deploy hook is triggered by `GET` or `POST` to `https://api.vercel.com/v1/integrations/deploy/{projectId}/{hookId}`, no auth, no body; response `{ job: { id, state: 'PENDING', createdAt } }` | Deploy Hooks docs | Zero-token mode is possible. `projectId` comes from the URL. |
| The returned `job.id` is **not** a deployment id; there is no documented correlation from a hook call to its deployment | vercel/vercel discussion #3875 (maintainer answer: query deployments by `since` timestamp) | Status needs a token and a time-window match (§10.1). |
| Deployments created by hooks have `source: 'git-deploy-hook'` | `/v7/deployments` response schema | The match filters on it. |
| "If you send multiple requests to deploy the same version of your project, previous deployments for the same Deploy Hook will be canceled" | Deploy Hooks docs | Bursts self-coalesce on Vercel's side; our debounce keeps the history clean and stays under the limit below. |
| 60 hook triggers per hour per project, across all hooks; 5 hooks per project (Hobby/Pro), 10 (Enterprise) | Deploy Hooks docs, Limits | The plugin never fires more than one trigger per target per quiet period; the view shows the hourly count. |
| `?buildCache=false` opts out of the build cache | Deploy Hooks docs | `buildCache` option, default true; "Deploy without cache" as a secondary action. |
| Hooks only exist for Git-connected projects; `github.enabled = false` in `vercel.json` disables them | Deploy Hooks docs | Documented prerequisite. |
| List: `GET /v7/deployments?projectId&teamId&since&until&state&target&limit`; states `QUEUED, INITIALIZING, BUILDING, READY, ERROR, CANCELED, BLOCKED, DELETED`; `readySubstate` `STAGED/ROLLING/PROMOTED`; fields `uid, url, inspectorUrl, created, buildingAt, ready, source, target ('production'/'staging'/null), errorCode, errorMessage, isRollbackCandidate, meta` | REST API deployments | Everything the ledger stores is here. |
| Get: `GET /v13/deployments/{idOrUrl}`; cancel: `PATCH /v12/deployments/{id}/cancel`; rollback: `POST /v1/projects/{projectId}/rollback/{deploymentId}`; promote: `POST /v10/projects/{projectId}/promote/{deploymentId}` | REST API deployments, projects | Cancel and rollback are one call each. Promote is not used in 0.1 (a fresh build is the normal path forward). |
| Account webhooks: Pro and Enterprise teams, up to 20 per team; events `deployment.created/succeeded/ready/promoted/error/canceled`; body `{ id, type, createdAt, region, payload: { deployment: { id, url, meta, name }, project: { id }, target, links: { deployment, project }, team, user } }` | Webhooks docs, Webhooks API | Push updates are optional; the `id` gives idempotency. |
| `x-vercel-signature` = HMAC-SHA1 hex of the raw request body with the webhook secret; compare with `timingSafeEqual` | Request headers docs | Endpoint reads `req.text()` before any parsing. |
| Vercel cron: Hobby = once per day, ±59 min; Pro/Enterprise = per minute | Cron usage & pricing | A Vercel cron cannot be the debounce runner on Hobby. The admin heartbeat is (§9.3). |

## 5. Architecture

```
 editor saves / publishes / deletes            editor presses Deploy      app code
            │                                          │                     │
   afterChange / afterDelete hooks              POST /api/vercel/deploy   payload.vercel.deploy()
   (opted-in collections & globals)                    │                     │
            │                                          └──────────┬──────────┘
            ▼                                                     ▼
   vercel-changes (one row per target × document)        trigger(target, cause)
   vercel-status.targets[].dueAt = now + quietPeriod              │
            │                                                     │  fold pending changes into
            │  tick (admin heartbeat · beacon flush ·             │  the summary, delete rows
            │  vercel:tick job · POST /api/vercel/tick)           ▼
            └──────────── dueAt reached ────────────▶  vercel-deployments row (state: triggered)
                                                                  │
                                                     POST deploy hook (Vercel)
                                                                  │
                          ┌── VERCEL_TOKEN ──────────────────────┼─────────────── no token ──┐
                          ▼                                      ▼                           ▼
             resolve: GET /v7/deployments?since        POST /api/vercel/webhook       state stays 'triggered'
             source=git-deploy-hook → match            (HMAC-SHA1, Pro/Enterprise)    → 'unknown' after 15 min
                          │                                      │
                          └──────────── state machine (§10.4) ───┘
                                                    │
                     ready ─────────────▶ row closed; nothing else to do
                     error / canceled ──▶ row closed; its changes re-instated as pending
                     rollback ──────────▶ changes of every newer deployment re-instated
```

Three stores, all small: the `vercel-deployments` ledger, the `vercel-changes` pending set, and a hidden `vercel-status` global with one entry per target (§7). Nothing is stored about Vercel that Vercel does not already know except who in Payload asked for a deployment and why.

## 6. Developer experience

### 6.1 Registering

```ts
import { vercelPlugin } from '@payload-solutions/plugin-vercel'

export default buildConfig({
  plugins: [
    vercelPlugin({
      targets: [
        {
          slug: 'production',
          label: 'Website',
          hook: process.env.VERCEL_DEPLOY_HOOK_PRODUCTION!,   // https://api.vercel.com/v1/integrations/deploy/prj_…/…
          url: 'https://example.com',                        // shown as the "open site" link
        },
        {
          slug: 'staging',
          label: 'Staging',
          hook: process.env.VERCEL_DEPLOY_HOOK_STAGING!,
        },
      ],
      token: process.env.VERCEL_TOKEN,          // optional: status, history, cancel, rollback
      teamId: process.env.VERCEL_TEAM_ID,       // optional: needed when the token belongs to a team
      webhookSecret: process.env.VERCEL_WEBHOOK_SECRET, // optional: enables POST /api/vercel/webhook
      collections: {
        pages: true,                                  // all targets, on publish
        posts: { targets: ['production'], on: 'publish' },
        products: { on: 'change' },                   // collections without drafts: every save
      },
      globals: { header: true, footer: true },
      autoDeploy: { quietPeriod: '60s', maxWait: '10m' },   // Decided default; false = manual only
    }),
  ],
})
```

A target with a missing `hook` (empty env var) is registered as **not configured**: the admin shows it greyed with the variable name, nothing is triggered, nothing throws at boot. This is the local-development default.

### 6.2 Local API — `payload.vercel`

Same pattern as `payload.scheduler`: a `BasePayload` module augmentation, assigned in `onInit`.

```ts
type VercelAPI = {
  deploy(args: { target?: string; reason?: string; buildCache?: boolean; req?: PayloadRequest }): Promise<DeploymentRecord>
  deployAll(args?: { reason?: string; req?: PayloadRequest }): Promise<DeploymentRecord[]>
  status(target?: string): Promise<TargetStatus | TargetStatus[]>       // pending count, dueAt, current deployment, hourly trigger count
  pending(target: string, opts?: { limit?: number }): Promise<PendingChange[]>
  markChanged(args: { target?: string; collection?: CollectionSlug; global?: GlobalSlug; id?: string | number; title?: string; req?: PayloadRequest }): Promise<void>
  pause(target: string, paused: boolean): Promise<void>
  cancel(deploymentId: string): Promise<DeploymentRecord>
  rollback(args: { target: string; toDeploymentId: string; req?: PayloadRequest }): Promise<DeploymentRecord>
  refresh(target?: string): Promise<void>                               // resolve states now (token)
  tick(source?: TickSource): Promise<TickResult>                        // run due targets, refresh in-flight rows
}
```

`deploy()` with a single configured target needs no `target`. `markChanged()` is for content that reaches the site through code the hooks cannot see (a computed sitemap, an external feed). `req` is passed through so hooks inside a transaction reuse it (the multi-tenant lesson from the consent work).

### 6.3 Hooks for application code

```ts
hooks: {
  onTriggered: ({ record, target, cause }) => {},
  onStateChange: ({ record, previousState }) => {},
  onReady: ({ record }) => {},        // e.g. payload.emails.send('site-deployed', …)
  onError: ({ record }) => {},        // e.g. Slack via an action
  shouldTrack: ({ collection, doc, previousDoc, operation, req }) => boolean, // veto a change row
}
```

All hooks are awaited and errors are logged, never thrown into the request that caused them.

## 7. Data model

### 7.1 Collection `vercel-deployments` (the ledger)

| Field | Type | Notes |
| --- | --- | --- |
| `target` | select (slugs from options) | indexed with `createdAt` |
| `cause` | select `manual · auto · api · rollback · external` | `external` = seen on Vercel but not triggered by Payload (§10.5) |
| `triggeredBy` | relationship → admin user collection, nullable | null for `auto`, `external` and API calls without `req.user` |
| `reason` | text ≤ 200 | free text from the button dialog or `deploy({ reason })` |
| `hookJobId` | text | from the hook response |
| `deploymentId` | text, indexed | `dpl_…` once matched; unique when set |
| `deploymentUrl`, `inspectorUrl` | text | |
| `environment` | select `production · preview` | from `target` on the deployment (`'production'` → production, else preview) |
| `state` | select `triggered · queued · building · ready · error · canceled · unknown` | §10.4 |
| `readySubstate` | text | `STAGED/ROLLING/PROMOTED` when ready |
| `errorCode` | text ≤ 64 | |
| `errorMessage` | text ≤ 500, truncated | the only free-form error kept |
| `vercelCreatedAt`, `buildingAt`, `readyAt` | date | from Vercel |
| `durationMs` | number | `readyAt - vercelCreatedAt` |
| `changeCount` | number | how many pending rows were folded in |
| `changes` | json | `{ counts: { [collection]: n }, items: [{ c, id, t, op }] }`, `items` capped at 100 (§7.4) |
| `dedupeKey` | text | `${target}:${dueAt}` for auto, `${target}:${uuid}` otherwise; **unique with `target`** (§9.4) |
| `supersededBy` | relationship → self, nullable | set when Vercel canceled this build because a newer hook call arrived |
| `rollbackOf` / `rollbackTo` | text | deployment ids, for `cause: rollback` rows |

Admin: visible, group "Vercel", `useAsTitle: deploymentId`, list columns Target · When · Cause · By · State · Duration · Changes · Link; `access.create/update: () => false` for the admin UI (rows are written only by the plugin through the local API with `overrideAccess`), `delete` = `access.rollback`. Row actions live in the Deployments view (§12.2), the list is the searchable history.

### 7.2 Collection `vercel-changes` (pending set)

| Field | Type | Notes |
| --- | --- | --- |
| `target` | select | |
| `collection` / `global` | text | one of the two |
| `docId` | text | stringified; empty for globals |
| `title` | text ≤ 120 | from `admin.useAsTitle`, else `#id` |
| `operation` | select `create · update · delete · publish · unpublish` | the latest one wins |
| `user` | relationship → admin user collection, nullable | last editor |
| `changedAt` | date | last change |
| `saves` | number | how many saves since the row was created (shown as "×3") |

Unique index on (`target`, `collection`, `global`, `docId`): a document has one pending row per target no matter how often it is saved. `admin.hidden: true`; read through `GET /api/vercel/changes`.

### 7.3 Global `vercel-status` (hidden)

```ts
{ targets: [{
    slug, paused: boolean,
    pendingSince: Date | null, dueAt: Date | null,          // debounce window (§9.2)
    lastTriggerAt, lastTickAt, lastTickSource: 'heartbeat' | 'beacon' | 'job' | 'endpoint' | 'local',
    triggersLastHour: number,                                 // against the 60/hour limit
    currentDeploymentId, currentState, currentUrl,            // what is live / in flight
    lastResolvedAt,                                           // last successful Vercel API read
    lastError: string | null                                  // ≤ 300, e.g. "401 from Vercel API"
}] }
```

One document, a few hundred bytes per target. Written with `overrideAccess: true` on every tick; never shown as a global in the admin.

### 7.4 The size rule

Inherited from the scheduler spec and applied here: the ledger holds scalars and one capped JSON summary per deployment; no build logs, no request/response bodies, no webhook payloads (only the event `id` is kept, in memory, for idempotency within 24 h — §10.3). Pending rows are deleted when folded. Retention (option `retention`, default 90 days or last 200 per target, whichever is smaller) runs on the tick. A year of hourly deployments on one target is 8,760 rows of under 2 kB each; nothing here grows with content size.

## 8. Change tracking

- **Which saves count.** For collections with `versions.drafts`: a save whose `doc._status === 'published'` (publish, or re-publish) records `publish`; a transition published → draft (unpublish) records `unpublish`; draft saves and autosaves record nothing. For collections without drafts (`on: 'change'`, the default there): every `afterChange`. `afterDelete` always records `delete` (a live page has to disappear). Globals: every `afterChange`.
- **`on: 'change'` on a drafts collection** is allowed for sites that render drafts (preview targets): every save counts.
- **Localized documents** produce one row, not one per locale.
- **Which targets.** `collections.<slug>.targets` or all targets. A row is written per target; the header badge sums per target.
- **Title** is resolved from `admin.useAsTitle` at hook time and stored, so the pending list does not need a read per row later (and survives the document's deletion).
- **Veto.** `shouldTrack` in options, and `req.context.vercelSkip = true` from application code (bulk imports, migrations), suppress rows.
- **Re-instatement.** When a deployment ends in `error` or `canceled` and is not superseded (§10.4), its `changes.items` are written back as pending rows (deduped by the unique index, `saves` untouched). The badge then reads "3 changes not deployed · last deploy failed". Items beyond the 100-item cap cannot be re-instated; the row's `changeCount` is shown instead and the "Deploy" button is offered as the remedy. This is why the cap is 100 and not 20.
- **No token** means no failure signal, so nothing is ever re-instated; documented.

## 9. Triggering

### 9.1 Manual

The header button and `POST /api/vercel/deploy` call `trigger(target, { cause: 'manual', user: req.user, reason })` immediately: the debounce window is cleared, pending rows are folded, the hook is called. The button is disabled while a deployment for that target is `triggered/queued/building`, with "Deploy again" as a secondary action when a token is configured (Vercel will cancel the older build; the older row is marked `supersededBy`).

### 9.2 Automatic, with a quiet period (Decided: default 60 s)

Every recorded change sets, for each of its targets, `pendingSince = pendingSince ?? now` and `dueAt = min(now + quietPeriod, pendingSince + maxWait)`. Nothing else happens in the request. The deployment fires when a **tick** observes `dueAt <= now` (§9.3). Defaults: `quietPeriod: '60s'`, `maxWait: '10m'`; `autoDeploy: false` disables the mechanism entirely; `paused: true` on a target (toggle in the view) keeps recording changes but never sets `dueAt`.

Why not a Payload job with `waitUntil`: the job would need a runner to fire, and the runner is exactly what a serverless Payload on Vercel Hobby cannot provide (cron is once per day, §4). Holding a `dueAt` timestamp in the status global lets *any* caller act as the runner, and needs no `payload-jobs` row at all.

### 9.3 Ticks and runners

A tick is `payload.vercel.tick(source)`: for each target, fire if due and not paused; refresh in-flight rows older than 10 s from the Vercel API (token); apply retention once an hour. Sources, all enabled by default:

| Source | How | When it matters |
| --- | --- | --- |
| **Admin heartbeat** | the header widget's status poll (`GET /api/vercel/status`) runs a tick server-side | The editor who made the change is in the admin; the deploy fires while they watch the countdown. This is WP-Cron's model, and Action Scheduler's — the plugin the scheduler spec ports. |
| **Beacon flush** | on `pagehide`/`visibilitychange: hidden` the widget sends `navigator.sendBeacon('/api/vercel/flush')`; the endpoint fires any due-or-pending target for that user's targets **immediately** rather than waiting out the window | The editor closes the tab 20 s after saving. Cookies travel with the beacon, so Payload auth applies. |
| **`vercel:tick` task** | registered on queue `vercel` with a native `schedule` of `* * * * *`; runs under `jobs.autoRun` (long-running servers), `payload jobs:run`, a Pro cron on `/api/payload-jobs/run?queue=vercel`, or Payload Clock | Headless writes (imports, `markChanged` from scripts) with no admin open. The job has no input and is deleted on completion (size rule). |
| **`POST /api/vercel/tick`** | header `x-vercel-plugin-secret` (option `tick.secret`) or an admin session | Any external cron, uptime monitor, or Payload Clock hitting an endpoint. |

The view shows "Last tick: 12 s ago (heartbeat)". If no tick arrives for 15 minutes while something is pending, the header widget turns amber: "Pending deploy is waiting for a runner" with a docs link. Without any runner and without an admin open, an auto deploy simply waits; the next admin visit or beacon fires it. That is the accepted trade-off of the zero-infrastructure default.

### 9.4 Exactly one trigger per window

Two ticks (an admin poll and the cron job) can observe the same `dueAt`. The ledger row is created **before** the hook call with `dedupeKey = ${target}:${dueAt.getTime()}` under a unique index; the loser gets a unique-constraint error and returns without calling Vercel. Manual and API triggers use a random key. This is the same "unique index, not read-then-write" rule as the scheduler's `unique` actions. Folding pending rows into the winner happens after the insert succeeds; a change that lands between fold and hook call stays pending for the next window, which is correct.

### 9.5 The hook call

`POST {hook}[?buildCache=false]`, 10 s timeout, one retry on network error or 5xx, no retry on 4xx. Success stores `hookJobId` and `state: 'triggered'`; failure stores `state: 'error'`, `errorMessage` (status + first 200 chars of body) and re-instates the folded changes. `triggersLastHour` is incremented from a rolling list of trigger timestamps kept in the status global; at 55 the widget warns, at 60 auto deploys wait for the window to open (manual still allowed — Vercel returns the error and the row records it).

### 9.6 Zero-token mode

Everything above works. Rows stay `triggered` and move to `unknown` after 15 minutes; the widget shows "Deploy requested · 2 min ago" and a link to the Vercel dashboard. Cancel, rollback, history states and the changes re-instatement are unavailable and the view says which env var enables them.

## 10. Status resolution (token)

### 10.1 Matching a trigger to a deployment

There is no id to follow (§4). Starting 5 s after the hook call and on every tick while the row is `triggered`: `GET /v7/deployments?projectId={projectId}&teamId={teamId}&since={vercelCreatedAt - 30s}&limit=20`, candidates = `source === 'git-deploy-hook'` and `created >= hookCalledAt - 30 s` and not already claimed by another row (`deploymentId` unique), ordered by `created`; the earliest is claimed. After 10 minutes without a candidate the row becomes `unknown` (typical causes: hook belongs to another project, `github.enabled = false`, Vercel queued the job late). Two rows triggered within the same 30 s window are matched in trigger order; if Vercel canceled the earlier build, its deployment shows `CANCELED` and the row is marked `supersededBy` the later one rather than `canceled` (§10.4).

### 10.2 Polling

Rows in `triggered/queued/building` are refreshed by `GET /v13/deployments/{id}` on ticks, at most every 10 s per row (one request per in-flight deployment, none when idle). The admin widget polls `GET /api/vercel/status` every 10 s while something is pending or in flight, every 60 s otherwise, and stops when the tab is hidden. All Vercel reads go through one small client with the bearer token, `teamId` as query when set, and a 10 s timeout; 401/403 set `lastError` on the target and the widget shows "Vercel token rejected" instead of retrying blindly (once per minute after that).

### 10.3 Webhooks (Pro/Enterprise, optional)

`POST /api/vercel/webhook`: read `await req.text()`, verify `x-vercel-signature` (HMAC-SHA1 hex over the raw body with `webhookSecret`, `timingSafeEqual`, 403 otherwise), parse, and dispatch on `type`. Events for unknown projects are ignored with 200. `deployment.created` with a matching in-flight row (by `payload.deployment.id` if already claimed, else the §10.1 match against the event's project and timestamp) attaches the id; `deployment.succeeded`/`ready` → `ready`; `deployment.error` → `error`; `deployment.canceled` → `canceled` or superseded; `deployment.promoted` refreshes `readySubstate`. The event `id` is remembered for 24 h in a small in-memory LRU per process for idempotency (a duplicate delivery updates nothing; the state machine is idempotent anyway). Responses are immediate; Vercel work happens after the 200. With webhooks configured, polling backs off to once per minute for in-flight rows and stays as the fallback.

### 10.4 State machine

`triggered → queued → building → ready | error | canceled | unknown`. Terminal states never regress. `canceled` becomes **superseded** (state stays `canceled`, `supersededBy` set, changes *not* re-instated) when a newer row for the same target exists whose deployment was created after this one's and was not itself canceled. Otherwise `error` and `canceled` re-instate their changes (§8). Every transition calls `onStateChange`, plus `onReady`/`onError`.

### 10.5 External deployments

Git pushes and dashboard redeploys also change the site. On each refresh the plugin sees deployments in the `since` window that no row claims; with `recordExternalDeployments: true` (default) they become rows with `cause: 'external'` and no changes, so the history and the "current deployment" strip are complete. A `ready` external production deployment does not clear pending changes — the plugin cannot know whether that build included them — but the widget notes "site rebuilt from Git 3 min ago".

## 11. Cancel and rollback

- **Cancel** (`access.rollback`, in-flight rows only): `PATCH /v12/deployments/{id}/cancel`; the row becomes `canceled` through the normal refresh, changes re-instated.
- **Rollback** (`access.rollback`): for a target whose current production deployment is `ready`, the view lists the previous `ready` production deployments that Vercel reports `isRollbackCandidate: true` (fetched on demand, last 10). Confirming calls `POST /v1/projects/{projectId}/rollback/{deploymentId}`, writes a `cause: 'rollback'` row with `rollbackOf`/`rollbackTo`, sets the target's `currentDeploymentId` to the restored one, and re-instates the changes of every ledger row newer than the restored deployment (bounded by the 100-item cap; beyond it the badge shows the count from `changeCount`). Rollback is instant on Vercel — no build — so the row is `ready` immediately. Rolling forward again is a normal Deploy.
- Both are disabled without a token, and hidden entirely when `access.rollback` denies.

## 12. Admin UX

Same principles as the scheduler view: built from `@payloadcms/ui` primitives, no third-party UI, readable by a site owner without a developer.

### 12.1 Header widget (`admin.components.actions`)

Rendered top-right on every admin page. One line per configured target when there are several, collapsed to a menu beyond three. States, left to right (dot · text · action):

- grey · **Up to date** · Deploy
- blue · **3 changes · deploying in 42 s** · Deploy now
- blue pulsing · **Building… 1:12** · Cancel (token) — links to `inspectorUrl`
- green, 30 s · **Deployed** ✓ · Open site
- red · **Failed · 3 changes not deployed** · Deploy · Details
- amber · **Waiting for a runner** · Deploy now · Why?
- amber · **Paused · 12 changes** · Resume
- grey outlined · **Not configured** (missing `VERCEL_DEPLOY_HOOK_PRODUCTION`)

"Deploy" opens a small dialog: target (if several), optional reason, "skip build cache" checkbox, and the pending list (first 10 with links). Confirmation is one click. The countdown is driven by `dueAt` from the status response, ticking locally between polls.

### 12.2 Deployments view (`views.vercelDeployments`, `/admin/deployments`, `afterNavLinks` link)

Per target, top to bottom:

1. **Current** strip: state, `deploymentUrl`, `Open site`, `Inspect on Vercel`, `readySubstate`, deployed N min ago by whom, `triggersLastHour / 60`, last tick and its source, pause/resume toggle.
2. **Pending changes**: table Title · Collection · Change · By · When · ×saves, links to the documents, "Deploy now", "Deploy without cache".
3. **History**: last 20 rows (When · Cause / By · Reason · State · Duration · Changes · Links), row actions Cancel / Roll back to this / View changes (drawer listing `changes.items`), link to the full `vercel-deployments` list. Failed rows show `errorCode` and the truncated message inline.
4. **Setup** panel (collapsed once healthy): which env vars are set, token check result, webhook status, runner status.

### 12.3 Document pill (`admin.components.edit.beforeDocumentControls`)

Only on collections and globals that are tracked: **Live** (no pending row) · **Not deployed yet · Deploy now** (pending row, with the target when several) · **Deploying…** (folded into an in-flight row) · **Deploy failed** (re-instated). Reads one row by the unique key; no extra query when the document is untracked.

### 12.4 Live updates, empty states, responsiveness

The widget and the view share one status hook (SWR-style, the `GET /api/vercel/status` response) so they never disagree. Empty history: "No deployments yet — press Deploy to build the site for the first time". The widget collapses to the dot and a count under 900 px; the view stacks.

## 13. Endpoints

All under `/api/vercel/`, registered from the plugin's `endpoints`; every one except `webhook` requires an authenticated admin user and then the named access function.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/status?target=` | `read` | per-target status (§7.3 plus current row); runs a tick when `tick.adminHeartbeat` (default true) |
| GET | `/changes?target=&limit=` | `read` | pending rows |
| POST | `/deploy` `{ target?, reason?, buildCache? }` | `deploy` | manual trigger |
| POST | `/flush` | `deploy` | beacon: fire pending targets now |
| POST | `/tick` | admin session or `x-vercel-plugin-secret` | external runner |
| PATCH | `/pause` `{ target, paused }` | `deploy` | |
| POST | `/cancel` `{ deploymentId }` | `rollback` | token |
| POST | `/rollback` `{ target, toDeploymentId }` | `rollback` | token |
| GET | `/rollback-candidates?target=` | `rollback` | token, on demand |
| POST | `/webhook` | HMAC-SHA1 signature | Vercel account webhooks |

`access` defaults: `read` = any admin user, `deploy` = any admin user, `rollback` = any admin user. Payload Stack will set `deploy` and `rollback` to organization admins.

## 14. Integrations

- **Payload Clock**: the `vercel:tick` task on queue `vercel` is a scheduled task like any other; a Clock-driven project gets a reliable per-minute runner without Pro cron. Documented as the recommended runner for headless writes.
- **Action Scheduler**: not a dependency. A scheduled action may call `payload.vercel.deploy()` (nightly rebuild for date-dependent content); the recipe is in the docs.
- **Payload Emails**: `onReady`/`onError` recipes send a "site deployed" / "deploy failed" email through `payload.emails.send`.
- **Payload Stack**: no CLI prompt in v1 (Stack is a dynamic SaaS app). Two docs recipes: a static marketing site as a second Vercel project with `pages` and `posts` tracked; and "same project, use ISR instead". If Stack later ships a static marketing template, `stack.config.ts` gains `deploy.targets`.
- **Multi-tenant**: out of scope for 0.1; targets are global. A `targets` resolver receiving `req` (per-tenant hooks) is the obvious 0.2 extension and the data model already keys everything by target slug.

## 15. Package layout and distribution

`packages/plugin-vercel`, scaffolded with `npx create-payload-app plugin-vercel -t plugin` and kept in that layout (Michael's rule: `src/` + `dev/` app + swc/tsc build + vitest/Playwright harness; relative imports with `.js`; `dev/tsconfig` `moduleResolution: bundler`; `pnpm dev` = `next dev dev --webpack`). Published as `@payload-solutions/plugin-vercel`.

```
src/
  index.ts                 vercelPlugin, types, BasePayload augmentation (payload.vercel)
  plugin.ts                collections, global, endpoints, jobs task, hooks injection, onInit
  options.ts               option validation, target normalisation, projectId parsing from the hook URL
  vercel/client.ts         fetch wrapper: bearer, teamId, timeouts, typed responses (deployments list/get/cancel, rollback, candidates)
  vercel/types.ts          the subset of Vercel's deployment and webhook shapes the plugin reads
  changes/track.ts         afterChange/afterDelete/global hooks, publish semantics, title resolution
  changes/fold.ts          fold pending rows into a ledger row; re-instate
  deploy/trigger.ts        dedupe insert, hook call, retries, hourly counter
  deploy/tick.ts           due targets, in-flight refresh, retention, runner bookkeeping
  deploy/match.ts          §10.1 matching
  deploy/state.ts          state machine and transitions → hooks
  endpoints/*.ts           one file per §13 row; webhook.ts does raw-body HMAC
  jobs/tick.ts             vercel:tick task
  collections/deployments.ts, collections/changes.ts, globals/status.ts
  admin/HeaderWidget.tsx (client), admin/DeployDialog.tsx, admin/DeploymentsView.tsx (server) + DeploymentsClient.tsx,
  admin/DocumentPill.tsx, admin/useVercelStatus.ts, admin/cells/*.tsx
  exports/client.ts, exports/rsc.ts
dev/                       Payload app with two tracked collections, one global, and a mock Vercel server
  vercel-mock/             tiny Node server: /v1/integrations/deploy/*, /v7/deployments, /v13/deployments/:id, cancel, rollback; scripted timelines
```

Peer dependencies: `payload ^3.88`, `@payloadcms/ui ^3.88`, `react ^19`, `next` (for nothing at runtime — the dev app only). No runtime dependencies beyond Node's `crypto` and `fetch`. Exports: `.`, `./client`, `./rsc`.

## 16. Plugin options

```ts
type VercelPluginOptions = {
  targets: Array<{
    slug: string; label?: string
    hook?: string                 // deploy hook URL; undefined → "not configured"
    url?: string                  // public site URL for "Open site"
    token?: string; teamId?: string; projectId?: string   // per-target overrides; projectId defaults to the hook's
    buildCache?: boolean          // default true
  }>
  token?: string; teamId?: string; webhookSecret?: string
  collections?: Record<CollectionSlug, true | { targets?: string[]; on?: 'publish' | 'change' }>
  globals?: Record<GlobalSlug, true | { targets?: string[] }>
  autoDeploy?: false | { quietPeriod?: string | number; maxWait?: string | number }   // '60s', '10m'
  tick?: { adminHeartbeat?: boolean; beacon?: boolean; job?: boolean | { queue?: string; cron?: string }; secret?: string }
  access?: { read?: Access; deploy?: Access; rollback?: Access }
  retention?: { days?: number; keep?: number }        // 90, 200
  recordExternalDeployments?: boolean                 // true
  hooks?: { onTriggered; onStateChange; onReady; onError; shouldTrack }
  admin?: { header?: boolean; view?: boolean | { path?: `/${string}` }; documentPill?: boolean; group?: string }
  slugs?: { deployments?: string; changes?: string; status?: string }
  disabled?: boolean
}
```

Validation at config time throws on duplicate target slugs, a hook that is not an `api.vercel.com/v1/integrations/deploy/…` URL, a collection or global slug that does not exist, and `targets` referenced by a collection that are not declared. A token without any target `projectId` resolvable is a warning, not an error.

## 17. Security and privacy

1. **Secrets** (`hook`, `token`, `webhookSecret`, `tick.secret`) are read from options at boot and never written to the database, never sent to the client, never logged; the setup panel shows only "set / not set" and the env var name. A deploy hook URL is a credential (anyone with it can deploy) — the docs say so in the first paragraph.
2. **Token scope**: Vercel tokens are account- or team-scoped, not project-scoped. Recommend a dedicated team token from a service account, and document that the plugin uses only the deployments and rollback endpoints.
3. **Webhook**: signature required when `webhookSecret` is set; the endpoint is not registered at all when it is not. Body size capped at 256 kB. No secrets in the response.
4. **Naming**: Vercel's trademark policy (fetched 11 September 2026) contains no rule on third-party plugin names; it prohibits use that misleads about affiliation. "Vercel Integration" is descriptive and the package is scoped under `@payload-solutions`; the docs carry "Vercel is a trademark of Vercel, Inc. This plugin is not affiliated with or endorsed by Vercel." No Vercel logo is used in the admin (a plain triangle glyph of our own or none).
5. **Personal data**: the ledger stores the admin user relationship and a free-text reason; the changes rows store document titles. Nothing about site visitors. Retention bounds both.
6. **Abuse of the trigger**: `access.deploy` gates every trigger path; the 60/hour Vercel limit is enforced client-side for auto deploys and reported for manual ones; `/flush` cannot fire more than once per target per 10 s.

## 18. Compatibility and constraints

- Payload `^3.88`. Slots used, all verified in the installed copy: root `admin.components.actions`, `afterNavLinks`, `views[key] = { Component, path, exact }`; collection `admin.components.edit.beforeDocumentControls`; `endpoints`; `jobs.tasks` with native `schedule`; collection/global `afterChange`, collection `afterDelete`. Payload 4: the same slots exist in the canary checkout but the custom-view props changed shape — to verify before claiming support; the plugin isolates them in `admin/*View.tsx`.
- Databases: Postgres, MongoDB, SQLite. The unique indexes (§7.1, §7.2) are declared through field `unique`/`index` options and a compound index in `collection.indexes`, supported by all three adapters in 3.88.
- Serverless: no timers, no in-process state except the 24 h webhook LRU (which is per process and only an optimisation). The heartbeat model assumes an admin session or a runner exists; §9.3 states the consequence when neither does.
- Vercel: hooks need a Git-connected project; Hobby cron cannot tick per minute; account webhooks need Pro/Enterprise; `github.enabled = false` disables hooks. All four are in the setup panel's checklist.
- Same-project setups: a deploy rebuilds the admin too. Vercel deployments are atomic, so nothing breaks mid-build; the docs still recommend ISR for that case.

## 19. Testing

- **Unit** (vitest): hook URL parsing; publish/unpublish semantics against `_status` transitions; `dueAt` arithmetic with `quietPeriod`/`maxWait`; the §10.1 matcher against fixture lists (two triggers in one window, superseded builds, external deployments); state machine transitions and re-instatement; HMAC verification with Vercel's documented example; the hourly counter.
- **Integration** (dev app, real database): hooks write and dedupe pending rows; fold on trigger; concurrent ticks produce exactly one ledger row (unique-key race, run 50×); retention; `payload.vercel.*` API; every endpoint's access; webhook idempotency.
- **E2E** (Playwright, mock Vercel server with scripted timelines): header widget states and countdown; Deploy dialog; document pill on a tracked and an untracked collection; Deployments view cancel and rollback; beacon flush on tab close.
- **Live checklist** (manual, before each release): one real Hobby project and one Pro team — hook trigger, match, ready, error (broken build command), cancel, rollback, webhook signature.

## 20. Milestones

All three are in 0.1 (Decided); the order is for building and verifying in the dev app.

- **M1 — trigger and track**: options, targets, hook call, ledger and changes collections, publish semantics, header widget, Deploy dialog, quiet period with heartbeat and beacon ticks, zero-token mode. Verifiable against the mock server without any token.
- **M2 — status**: Vercel client, matching, polling, state machine, re-instatement, Deployments view, history list, cancel, rollback, external deployments, `vercel:tick` task, `/tick` endpoint.
- **M3 — push and polish**: webhook endpoint, document pill, retention, setup panel, docs (`docs/plugins/vercel-integration/*`: index, installation, configuration, auto-deploy, status, recipes), catalogue/roadmap update, publish.

## 21. Open decisions

1. **Admin heartbeat as a runner** (§9.3): proposed on by default because it is the only mechanism that works on every host with zero setup. Alternative: off by default, with the amber "waiting for a runner" state pushing users to Clock or cron.
2. **Record external deployments** (§10.5): proposed on by default (complete history). Alternative: off, showing only Payload-triggered rows.
3. **`vercel-deployments` visible as a read-only collection** (§7.1) versus hidden with the custom view as the only surface. Proposed visible (free filtering, search and per-row page).
4. **Product name**: "Vercel Integration" as in the catalogue, or "Payload Deploy for Vercel" to keep the family naming and avoid any trademark question in the first word. Pending the Payload trademark answer either way.
5. **Rollback re-instatement cap** (§11): the 100-item cap per deployment is proposed; 250 would cover larger sessions at ~5× the row size.

## 22. References

- Vercel — Creating & Triggering Deploy Hooks: https://vercel.com/docs/deploy-hooks (URL shape, GET/POST, response, `buildCache`, cancel-previous behaviour, 60/hour and 5/10 per project limits, Git requirement)
- Vercel — Setting Up Webhooks: https://vercel.com/docs/webhooks (Pro/Enterprise, events, secret, 20 per team)
- Vercel — Webhooks API reference: https://vercel.com/docs/webhooks/webhooks-api (event types, payload fields)
- Vercel — Request headers, `x-vercel-signature`: https://vercel.com/docs/headers/request-headers (HMAC-SHA1 of raw body, `timingSafeEqual` sample)
- Vercel — REST API, deployments: https://vercel.com/docs/rest-api/deployments and list-deployments: https://vercel.com/docs/rest-api/deployments/list-deployments (`/v7/deployments`, states, `source: git-deploy-hook`, `readySubstate`, `isRollbackCandidate`)
- Vercel — REST API, projects: https://vercel.com/docs/rest-api/projects (`/v1/projects/{id}/rollback/{deploymentId}`, `/v10/projects/{id}/promote/{deploymentId}`)
- Vercel — Cron jobs usage & pricing: https://vercel.com/docs/cron-jobs/usage-and-pricing (Hobby once per day ±59 min; Pro per minute)
- Vercel — Trademark policy: https://vercel.com/legal/trademark-policy
- vercel/vercel discussion #3875, "Deploy hook status": https://github.com/vercel/vercel/discussions/3875 (job id ≠ deployment id; query by `since`)
- strapi-plugin-vercel-deploy (MIT): https://github.com/gianlucaparadise/strapi-plugin-vercel-deploy
- Payload 3.88 sources as installed: `config/types.d.ts` (`admin.components.actions`, `afterNavLinks`, `views`), `collections/config/types.d.ts` (`beforeDocumentControls`, `AfterChangeHook`, `AfterDeleteHook`), `admin/views/index.d.ts` (`AdminViewConfig`), `queues/localAPI.d.ts` (`queue({ waitUntil })`), `queues/config/types/index.d.ts` (`autoRun`, `deleteJobOnComplete`)
- `notes/plugin-action-scheduler-spec.md` §4.1 (size rule), §9.3/§9.7 (claims by unique index), §11 (runners)
