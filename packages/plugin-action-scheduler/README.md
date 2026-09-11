# @payload-solutions/plugin-action-scheduler

WooCommerce Action Scheduler for Payload CMS. Declare an action once in code, schedule it at runtime with arguments — once, as soon as possible, on an interval or on a cron — and let Payload's job queue run it. The plugin keeps a small, bounded ledger of every action and gives the admin a Scheduled Actions view with status tabs, a Run queue button, runner health, per-row Run now / Retry / Cancel and a log for every action.

```ts
await payload.scheduler.schedule('orders.remind', { orderId }, { scheduleAt: tomorrow })
await payload.scheduler.cron('reports.weekly', {}, { cron: '0 9 * * 1', tz: 'Europe/Warsaw' })
```

Design reference: `notes/plugin-action-scheduler-spec.md` in the payload-ecosystem repo.

## Install

```sh
pnpm add @payload-solutions/plugin-action-scheduler
```

Peer dependencies: `payload ^3.88`, `@payloadcms/ui ^3.88`, `react`, `react-dom`. `croner` (the cron engine Payload already uses) ships with the plugin.

## 1. Declare an action

```ts
// src/actions/orders-remind.ts
import { defineAction, SkipAction } from '@payload-solutions/plugin-action-scheduler'

export const ordersRemind = defineAction({
  slug: 'orders.remind',
  label: 'Remind customer about unpaid order',
  group: 'orders',
  inputSchema: [{ name: 'orderId', type: 'text', required: true }],
  retries: 3,            // default; exponential backoff 30 s → 1 h
  timeout: '2m',         // default '5m'
  handler: async ({ args, req, log }) => {
    const order = await req.payload.findByID({ collection: 'orders', id: args.orderId, req })
    if (order.paid) throw new SkipAction('already paid')
    await req.payload.emails.send('payment-reminder', { input: { order }, req })
    log(`reminder sent to ${order.email}`)
    return { note: 'reminder sent' } // ≤ 256 chars; nothing else is stored
  },
})
```

Throw to fail the attempt (retried per policy), `PermanentError` to fail without retries, `SkipAction(reason)` to complete without doing anything. `signal` aborts on timeout.

## 2. Register

```ts
import { actionScheduler } from '@payload-solutions/plugin-action-scheduler'

export default buildConfig({
  plugins: [
    actionScheduler({
      actions: [ordersRemind, cleanupCarts],
      recurring: [{ key: 'carts.nightly', hook: 'cleanup.carts', cron: '0 3 * * *', tz: 'Europe/Warsaw' }],
    }),
  ],
  jobs: { autoRun: [{ cron: '* * * * *' }] }, // or Vercel cron → /api/payload-jobs/run, or Payload Clock
})
```

Run `payload generate:types` and every hook and its arguments are typed through `Config['scheduledActions']`.

## 3. Schedule

```ts
payload.scheduler.schedule(hook, args, { scheduleAt, group, unique, priority, queue, req })
payload.scheduler.enqueue(hook, args)                              // as soon as possible
payload.scheduler.recurring(hook, args, { every: '1h', startAt })
payload.scheduler.cron(hook, args, { cron: '0 9 * * 1', tz })
payload.scheduler.cancel(hook, { args, group }) / cancelAll / cancelByID(id)
payload.scheduler.next(hook, match)   // Date | 'running' | null
payload.scheduler.has(hook, match)
payload.scheduler.find({ hook, status, group })
payload.scheduler.runQueue()          // what the admin button calls
```

Function-style exports (`scheduleAction(payload, …)`, `unscheduleAction`, `nextScheduledAction`, …) mirror the `as_*` API.

## Why the ledger stays small

Payload deletes successful jobs because each job stores its input and every log entry stores input, output and error again. This plugin never does that: arguments are stored once and capped (`maxArgsBytes`, 8 KB), handler output is never stored, only the latest error is kept (truncated), log lines are short and capped at 50 per action, retention purges finished rows, and the transport job carries only `{ actionId }` and completes normally so Payload still deletes it.

## Runners

Anything that runs Payload jobs runs actions: `jobs.autoRun`, `payload jobs:run --all-queues --handle-schedules`, Vercel cron calling `GET /api/payload-jobs/run?allQueues=true`, Payload Clock, or the admin's **Run queue** button. A `scheduler:tick` task (Payload's own `schedule`) promotes far-future actions, recovers lost attempts, purges by retention and records a heartbeat the admin turns into runner health. `tick: false` switches it off.

## Development

```sh
pnpm dev            # admin on http://localhost:3310 (dev@payloadcms.com / test)
pnpm test:unit      # engine state machine + utilities, no database
pnpm test:int       # real Payload on SQLite
pnpm test:e2e       # Playwright against the dev app
```

Scaffolded with `create-payload-app -t plugin` (same layout as the other payload-solutions plugins: `src/` is the plugin, `dev/` is a Next + Payload app that uses it).
