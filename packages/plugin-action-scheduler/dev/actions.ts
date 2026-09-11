import { defineAction, PermanentError, SkipAction } from '@payload-solutions/plugin-action-scheduler'

/** What each handler did, for tests and the dev console. */
export const executions: { args: Record<string, unknown>; at: Date; attempt: number; hook: string }[] = []

export const ordersRemind = defineAction({
  slug: 'orders.remind',
  description: 'Sends the payment reminder for one order.',
  group: 'orders',
  handler: async ({ action, args, log }) => {
    executions.push({ args, at: new Date(), attempt: action.attempt, hook: 'orders.remind' })
    if (args.orderId === 'paid') {
      throw new SkipAction('already paid')
    }
    log(`reminder sent for ${String(args.orderId)}`)
    return { note: `reminded ${String(args.orderId)}` }
  },
  inputSchema: [{ name: 'orderId', type: 'text', required: true }],
  label: 'Remind customer about unpaid order',
})

export const flaky = defineAction({
  slug: 'webhooks.deliver',
  backoff: { type: 'fixed', delay: '1s' },
  description: 'Fails until the attempt number reaches `succeedOn`.',
  group: 'integrations',
  handler: async ({ action, args }) => {
    executions.push({ args, at: new Date(), attempt: action.attempt, hook: 'webhooks.deliver' })
    const succeedOn = Number(args.succeedOn ?? 1)
    if (args.permanent) {
      throw new PermanentError('410 Gone: endpoint removed by receiver')
    }
    if (action.attempt < succeedOn) {
      throw new Error(`connect ECONNRESET (attempt ${action.attempt})`)
    }
  },
  inputSchema: [
    { name: 'endpointId', type: 'text', required: true },
    { name: 'succeedOn', type: 'number' },
    { name: 'permanent', type: 'checkbox' },
  ],
  label: 'Deliver an outgoing webhook',
  retries: 3,
})

export const slow = defineAction({
  slug: 'media.optimize',
  description: 'Sleeps for `ms` milliseconds; times out after 300 ms.',
  group: 'media',
  handler: async ({ args, signal }) => {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, Number(args.ms ?? 1000))
      signal.addEventListener('abort', () => {
        clearTimeout(t)
        resolve()
      })
    })
  },
  inputSchema: [{ name: 'ms', type: 'number' }],
  label: 'Generate optimized image sizes',
  retries: 1,
  timeout: 0.3,
})

export const rollup = defineAction({
  slug: 'analytics.rollup',
  description: 'Rolls page views into hourly buckets.',
  group: 'analytics',
  handler: async () => {
    executions.push({ args: {}, at: new Date(), attempt: 1, hook: 'analytics.rollup' })
  },
  label: 'Roll up page views',
})

export const actions = [ordersRemind, flaky, slow, rollup]
