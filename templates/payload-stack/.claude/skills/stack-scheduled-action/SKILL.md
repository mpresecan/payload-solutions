---
name: stack-scheduled-action
description: Use when something in this Payload Stack project must happen later or on a schedule (reminders, follow-ups, sweeps, cron-like jobs, retries) using the Action Scheduler in src/scheduler.
---

# Add a scheduled or recurring action

First check the project has the scheduler:

```bash
ls src/scheduler/actions 2>/dev/null && echo "scheduler installed" || echo "no scheduler"
```

Without `src/scheduler/actions`, `src/scheduler/*` is the empty half of a seam (`schedulerPlugins`
is `[]`, `schedulerJobs` is `undefined`). Do not hand-roll a cron route; tell the user the project
was scaffolded without the scheduler, and that `npx create-payload-stack --scheduler` adds it in a
new project (docs: https://payload.solutions/docs/plugins/payload-action-scheduler).

## 1. Define the action

Put it in the matching file under `src/scheduler/actions/` (`billing.ts`, `emails.ts`,
`maintenance.ts`) or a new one. Copy `pruneAuthRecords` in `maintenance.ts`:

```ts
import { defineAction, PermanentError, SkipAction } from '@payload-solutions/plugin-action-scheduler'

export const remindInactive = defineAction<{ userId: string }>({
  slug: 'accounts.remind-inactive', // a promise: ledger rows refer to it, never rename
  label: 'Remind an inactive user',
  description: 'Sends one nudge to a user who has not signed in for 14 days.',
  group: 'accounts',
  retries: 3,
  timeout: '2m',
  inputSchema: [{ name: 'userId', type: 'text', required: true }],
  handler: async ({ args, log, payload }) => {
    // return { note } for the ledger; throw to retry;
    // throw new SkipAction('why') to stop without failing; throw new PermanentError('why') to fail without retrying
    log('...')
    return { note: 'sent' }
  },
})
```

Rules:

- Handlers run outside a request. Use `payload` from the handler, `overrideAccess: true`, and
  scope every query explicitly (by tenant, user or id from `args`). There is no session.
- `args` are stored in the ledger and shown in the admin: keep them to ids, never secrets or full
  documents. Re-read current state in the handler; it may have changed since scheduling.
- Make handlers idempotent: a retry must not send twice or double-charge.
- Destructive actions (deleting users, data) ship with `retries: 0` and no recurring series, like
  `accounts.purge-unverified`.
- Messages go through `notify` from `@/emails/hooks`, never the emails plugin directly.

## 2. Register it

In `src/scheduler/actions/index.ts`:

- add it to `actions`, gated on `stack.features.*` (and `emailsEnabled` if it sends email) when the
  feature may be off, so the admin lists only what this product can do;
- for a recurring job, add `{ key, hook: action.slug, cron }` to `recurring`. Crons are UTC and
  deliberately off the hour (`'15 3 * * *'`). Series are reconciled on every boot.

Run `pnpm generate:types`: the slug and its args become typed under `Config['scheduledActions']`.

## 3. Schedule a one-off from code

```ts
await payload.scheduler.schedule(
  'accounts.remind-inactive',
  { userId },
  { scheduleAt: new Date(Date.now() + 14 * 864e5), group: `user:${userId}`, unique: true },
)
// later, if the reason went away:
await payload.scheduler.cancelAll('accounts.remind-inactive', { group: `user:${userId}` })
```

`group` lets you cancel a family of rows; `unique: true` stops duplicates. To email later without a
new action, schedule the existing `emails.send` action with `{ slug, to, input }`.

From Better Auth or Stripe callbacks, add the logic to `src/scheduler/hooks.ts`
(`withStripeEvents`, `withTrialCallbacks`). Those wrap the email bundles; do not add a second
`stripe({ onEvent })` beside them, or one silently replaces the other.

## 4. Running the queue

Nothing runs due actions by itself on serverless. `src/scheduler/jobs.ts` accepts
`Authorization: Bearer $CRON_SECRET` on `GET /api/payload-jobs/run?allQueues=true`; Payload Clock,
Vercel Cron or a server's own cron calls it. In development, set `RUN_JOBS_IN_PROCESS=true` in
`.env`, or run it by hand from **System → Scheduled Actions** in the admin.

## Tests

`tests/unit/scheduler.spec.ts` checks the catalogue and series under each preset. Add the new slug
to the expectations for the presets that should register it, and unit-test the handler with a
fake `payload`. Finish with `pnpm verify`.
